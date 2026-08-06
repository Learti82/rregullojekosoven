"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canEditReport, isAdmin, requireUser } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uniqueSlug } from "@/lib/utils";
import { isOwnedStorageUrl, deleteObjects } from "@/lib/storage";
import { notify } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";
import { predictPriority, suggestCategory } from "@/lib/ai/classifier";
import { createReportSchema, updateReportSchema, voteSchema } from "@/validations/report";
import { logActivity, nextReportReference, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

export async function createReportAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("createReport", user.id);

    const rawImages = formData.get("images");
    const parsed = parseInput(createReportSchema, {
      title: formData.get("title"),
      description: formData.get("description"),
      categoryId: formData.get("categoryId"),
      municipalityId: formData.get("municipalityId"),
      latitude: Number(formData.get("latitude")),
      longitude: Number(formData.get("longitude")),
      address: formData.get("address") ?? "",
      priority: formData.get("priority") ?? "MEDIUM",
      isAnonymous: formData.get("isAnonymous") === "on" || formData.get("isAnonymous") === "true",
      images: rawImages ? JSON.parse(String(rawImages)) : [],
    });
    if (!parsed.ok) return parsed.result;

    const input = parsed.data;

    // Reject any image URL that did not come from our own bucket, so a crafted
    // payload cannot embed third-party or tracking content in a report.
    if (input.images.some((image) => !isOwnedStorageUrl(image.url))) {
      return { success: false, error: "Një ose më shumë imazhe nuk janë të vlefshme." };
    }

    // Confirm the referenced taxonomy is real and active before writing.
    const [category, municipality] = await Promise.all([
      prisma.category.findFirst({ where: { id: input.categoryId, isActive: true } }),
      prisma.municipality.findFirst({ where: { id: input.municipalityId, isActive: true } }),
    ]);
    if (!category) return { success: false, error: "Kategoria e zgjedhur nuk ekziston." };
    if (!municipality) return { success: false, error: "Komuna e zgjedhur nuk ekziston." };

    const aiCategory = suggestCategory(`${input.title} ${input.description}`);
    const aiPriority = predictPriority({
      title: input.title,
      description: input.description,
      categorySlug: category.slug,
    });

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          title: input.title,
          description: input.description,
          slug: uniqueSlug(input.title),
          reference: await nextReportReference(tx),
          categoryId: input.categoryId,
          municipalityId: input.municipalityId,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address || null,
          priority: input.priority,
          isAnonymous: input.isAnonymous,
          createdById: user.id,
          aiCategoryGuess: aiCategory?.slug ?? null,
          aiConfidence: aiCategory?.confidence ?? null,
          aiPriorityGuess: aiPriority,
          images: {
            create: input.images.map((image, index) => ({
              url: image.url,
              key: image.key,
              sizeBytes: image.sizeBytes,
              mimeType: image.mimeType,
              width: image.width,
              height: image.height,
              caption: image.caption || null,
              sortOrder: index,
              uploadedById: user.id,
            })),
          },
          statusHistory: {
            create: { toStatus: "PENDING", changedById: user.id, note: "Raporti u krijua." },
          },
          // Authors follow their own reports so status updates reach them.
          followers: { create: { userId: user.id } },
        },
        select: { id: true, slug: true, title: true, municipalityId: true },
      });

      await tx.report.update({
        where: { id: created.id },
        data: { followersCount: 1 },
      });

      await tx.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, reportsCount: 1 },
        update: { reportsCount: { increment: 1 } },
      });

      return created;
    });

    // Alert the municipality's staff that something new landed in their queue.
    const staff = await prisma.user.findMany({
      where: {
        municipalityId: report.municipalityId,
        isActive: true,
        role: { name: { in: ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN"] } },
      },
      select: { id: true },
    });
    if (staff.length > 0) {
      await notify({
        userIds: staff.map((s) => s.id),
        actorId: user.id,
        reportId: report.id,
        type: "SYSTEM",
        title: "Raport i ri në komunën tuaj",
        body: report.title,
        url: `/reports/${report.slug}`,
      });
    }

    await evaluateBadges(user.id);
    await logActivity({
      userId: user.id,
      action: "report.create",
      entityType: "report",
      entityId: report.id,
      metadata: { municipalityId: report.municipalityId, categoryId: input.categoryId },
    });

    revalidatePath("/explore");
    revalidatePath("/map");
    revalidatePath("/feed");

    return ok({ slug: report.slug }, "Raporti u publikua me sukses.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateReportAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  try {
    const user = await requireUser();

    const parsed = parseInput(updateReportSchema, {
      id: formData.get("id"),
      title: formData.get("title"),
      description: formData.get("description"),
      categoryId: formData.get("categoryId"),
      address: formData.get("address") ?? "",
      priority: formData.get("priority") ?? "MEDIUM",
    });
    if (!parsed.ok) return parsed.result;

    const report = await prisma.report.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, slug: true, createdById: true, status: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };

    if (!canEditReport(user, report)) {
      return {
        success: false,
        error: "Raporti mund të redaktohet vetëm derisa është në pritje.",
      };
    }

    // Priority is a municipal judgement call — citizens cannot escalate it.
    const priority = isAdmin(user) ? parsed.data.priority : undefined;

    await prisma.report.update({
      where: { id: report.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        categoryId: parsed.data.categoryId,
        address: parsed.data.address || null,
        ...(priority ? { priority } : {}),
      },
    });

    await logActivity({
      userId: user.id,
      action: "report.update",
      entityType: "report",
      entityId: report.id,
    });

    revalidatePath(`/reports/${report.slug}`);
    revalidatePath("/explore");
    return ok({ slug: report.slug }, "Raporti u përditësua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteReportAction(reportId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        slug: true,
        createdById: true,
        status: true,
        images: { select: { key: true } },
      },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };
    if (!canEditReport(user, report)) {
      return { success: false, error: "Nuk keni leje ta fshini këtë raport." };
    }

    await prisma.$transaction([
      prisma.report.delete({ where: { id: report.id } }),
      prisma.profile.update({
        where: { userId: report.createdById },
        data: { reportsCount: { decrement: 1 } },
      }),
    ]);

    // Storage cleanup after the row is gone; a failure here only leaves orphans.
    await deleteObjects(report.images.map((image) => image.key)).catch(() => undefined);

    await logActivity({
      userId: user.id,
      action: "report.delete",
      entityType: "report",
      entityId: report.id,
    });

    revalidatePath("/explore");
    revalidatePath("/map");
    revalidatePath("/feed");
    return ok(undefined, "Raporti u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Cast, switch or retract a vote.
 *
 * The unique (reportId, userId) index is the source of truth for "one vote per
 * user"; the counters on `reports` are updated in the same transaction so they
 * cannot drift.
 */
export async function voteAction(input: {
  reportId: string;
  type?: "UPVOTE" | "DOWNVOTE";
}): Promise<ActionResult<{ score: number; upvotes: number; downvotes: number; viewerVote: string | null }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("vote", user.id);

    const parsed = parseInput(voteSchema, { reportId: input.reportId, type: input.type ?? "UPVOTE" });
    if (!parsed.ok) return parsed.result;

    const { reportId, type } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { id: true, slug: true, createdById: true, title: true },
      });
      if (!report) throw new Error("REPORT_NOT_FOUND");

      const existing = await tx.vote.findUnique({
        where: { reportId_userId: { reportId, userId: user.id } },
      });

      let upDelta = 0;
      let downDelta = 0;
      let viewerVote: string | null = type;

      if (!existing) {
        await tx.vote.create({ data: { reportId, userId: user.id, type } });
        if (type === "UPVOTE") upDelta = 1;
        else downDelta = 1;
      } else if (existing.type === type) {
        // Clicking the same button again retracts the vote.
        await tx.vote.delete({ where: { id: existing.id } });
        if (type === "UPVOTE") upDelta = -1;
        else downDelta = -1;
        viewerVote = null;
      } else {
        await tx.vote.update({ where: { id: existing.id }, data: { type } });
        if (type === "UPVOTE") {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      }

      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          upvotes: { increment: upDelta },
          downvotes: { increment: downDelta },
          score: { increment: upDelta - downDelta },
        },
        select: { score: true, upvotes: true, downvotes: true, slug: true },
      });

      if (upDelta !== 0) {
        await tx.profile.updateMany({
          where: { userId: report.createdById },
          data: { votesReceived: { increment: upDelta } },
        });
      }

      return { updated, report, viewerVote, isNewUpvote: upDelta === 1 && !existing };
    });

    if (result.isNewUpvote) {
      await notify({
        userIds: [result.report.createdById],
        actorId: user.id,
        reportId,
        type: "REPORT_VOTED",
        title: "Raporti juaj mori një votë të re",
        body: result.report.title,
        url: `/reports/${result.report.slug}`,
      });
      await evaluateBadges(result.report.createdById);
    }

    revalidatePath(`/reports/${result.updated.slug}`);
    return ok({
      score: result.updated.score,
      upvotes: result.updated.upvotes,
      downvotes: result.updated.downvotes,
      viewerVote: result.viewerVote,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_NOT_FOUND") {
      return { success: false, error: "Raporti nuk u gjet." };
    }
    return toActionError(error);
  }
}

export async function toggleFollowAction(
  reportId: string
): Promise<ActionResult<{ following: boolean; followersCount: number }>> {
  try {
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.follower.findUnique({
        where: { reportId_userId: { reportId, userId: user.id } },
      });

      if (existing) {
        await tx.follower.delete({ where: { id: existing.id } });
        const report = await tx.report.update({
          where: { id: reportId },
          data: { followersCount: { decrement: 1 } },
          select: { followersCount: true, slug: true },
        });
        return { following: false, ...report };
      }

      await tx.follower.create({ data: { reportId, userId: user.id } });
      const report = await tx.report.update({
        where: { id: reportId },
        data: { followersCount: { increment: 1 } },
        select: { followersCount: true, slug: true },
      });
      return { following: true, ...report };
    });

    revalidatePath(`/reports/${result.slug}`);
    return ok(
      { following: result.following, followersCount: result.followersCount },
      result.following ? "Po ndiqni këtë raport." : "Nuk po e ndiqni më këtë raport."
    );
  } catch (error) {
    return toActionError(error);
  }
}
