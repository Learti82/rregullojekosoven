"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { truncate } from "@/lib/utils";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

/**
 * Administrator approval of citizen submissions.
 *
 * Nothing a citizen writes is publicly visible until it passes through here, so
 * these are the only two actions that can move a report into public view.
 */

const decisionSchema = z.object({
  reportId: z.string().cuid(),
  note: z.string().trim().max(500, "Shënimi nuk mund të kalojë 500 karaktere.").optional().or(z.literal("")),
});

const rejectSchema = decisionSchema.extend({
  note: z
    .string()
    .trim()
    .min(3, "Shkruani arsyen — autori do ta shohë.")
    .max(500, "Arsyeja nuk mund të kalojë 500 karaktere."),
});

export async function approveReportAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    const parsed = parseInput(decisionSchema, {
      reportId: formData.get("reportId"),
      note: formData.get("note") ?? "",
    });
    if (!parsed.ok) return parsed.result;

    const report = await prisma.report.findUnique({
      where: { id: parsed.data.reportId },
      select: {
        id: true,
        slug: true,
        title: true,
        createdById: true,
        municipalityId: true,
        moderationStatus: true,
      },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };
    if (report.moderationStatus === "APPROVED") {
      return { success: false, error: "Ky raport është miratuar tashmë." };
    }

    await prisma.report.update({
      where: { id: report.id },
      data: {
        moderationStatus: "APPROVED",
        moderatedAt: new Date(),
        moderatedById: admin.id,
        moderationNote: parsed.data.note || null,
      },
    });

    // The author learns their report is now public; municipal staff learn there
    // is something in their queue — neither was notified at submission time,
    // because until now the report did not exist as far as the public went.
    await notify({
      userIds: [report.createdById],
      actorId: admin.id,
      reportId: report.id,
      type: "SYSTEM",
      title: "Raporti juaj u miratua dhe është publik",
      body: truncate(report.title, 140),
      url: `/reports/${report.slug}`,
    });

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
        userIds: staff.map((member) => member.id),
        actorId: admin.id,
        reportId: report.id,
        type: "SYSTEM",
        title: "Raport i ri në komunën tuaj",
        body: truncate(report.title, 140),
        url: `/reports/${report.slug}`,
      });
    }

    await logActivity({
      userId: admin.id,
      action: "report.approved",
      entityType: "report",
      entityId: report.id,
    });

    revalidatePublicSurfaces(report.slug);
    return ok(undefined, "Raporti u miratua dhe është publik.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function rejectReportAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    const parsed = parseInput(rejectSchema, {
      reportId: formData.get("reportId"),
      note: formData.get("note") ?? "",
    });
    if (!parsed.ok) return parsed.result;

    const report = await prisma.report.findUnique({
      where: { id: parsed.data.reportId },
      select: { id: true, slug: true, title: true, createdById: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };

    await prisma.report.update({
      where: { id: report.id },
      data: {
        moderationStatus: "REJECTED",
        moderatedAt: new Date(),
        moderatedById: admin.id,
        moderationNote: parsed.data.note,
      },
    });

    // Always tell the author why. A rejection with no reason reads as censorship
    // on a platform whose whole premise is public accountability.
    await notify({
      userIds: [report.createdById],
      actorId: admin.id,
      reportId: report.id,
      type: "SYSTEM",
      title: "Raporti juaj nuk u publikua",
      body: parsed.data.note,
      url: `/reports/${report.slug}`,
    });

    await logActivity({
      userId: admin.id,
      action: "report.rejected",
      entityType: "report",
      entityId: report.id,
      metadata: { reason: parsed.data.note },
    });

    revalidatePublicSurfaces(report.slug);
    return ok(undefined, "Raporti u refuzua dhe autori u njoftua.");
  } catch (error) {
    return toActionError(error);
  }
}

/** Approve several at once — the common case when clearing a queue. */
export async function approveManyAction(
  reportIds: string[]
): Promise<ActionResult<{ approved: number }>> {
  try {
    const admin = await requireRole("ADMIN");

    const ids = z.array(z.string().cuid()).max(100).parse(reportIds);
    if (ids.length === 0) return ok({ approved: 0 });

    const reports = await prisma.report.findMany({
      where: { id: { in: ids }, moderationStatus: "PENDING_REVIEW" },
      select: { id: true, slug: true, title: true, createdById: true },
    });

    await prisma.report.updateMany({
      where: { id: { in: reports.map((r) => r.id) } },
      data: {
        moderationStatus: "APPROVED",
        moderatedAt: new Date(),
        moderatedById: admin.id,
      },
    });

    for (const report of reports) {
      await notify({
        userIds: [report.createdById],
        actorId: admin.id,
        reportId: report.id,
        type: "SYSTEM",
        title: "Raporti juaj u miratua dhe është publik",
        body: truncate(report.title, 140),
        url: `/reports/${report.slug}`,
      });
    }

    await logActivity({
      userId: admin.id,
      action: "report.approved_bulk",
      entityType: "report",
      metadata: { count: reports.length },
    });

    revalidatePublicSurfaces();
    return ok({ approved: reports.length }, `${reports.length} raporte u miratuan.`);
  } catch (error) {
    return toActionError(error);
  }
}

/** Every surface that lists reports must drop its cache after a decision. */
function revalidatePublicSurfaces(slug?: string) {
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/explore");
  revalidatePath("/map");
  revalidatePath("/admin/moderation");
  if (slug) revalidatePath(`/reports/${slug}`);
}
