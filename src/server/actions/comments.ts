"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canDeleteComment, isMunicipalityStaff, requireUser } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getReportAudience, notify } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";
import { truncate } from "@/lib/utils";
import { commentSchema } from "@/validations/report";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

export async function createCommentAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("comment", user.id);

    const parsed = parseInput(commentSchema, {
      reportId: formData.get("reportId"),
      parentId: formData.get("parentId") ?? "",
      body: formData.get("body"),
    });
    if (!parsed.ok) return parsed.result;

    const { reportId, parentId, body } = parsed.data;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, slug: true, title: true, createdById: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };

    // A reply must belong to the same report — otherwise a crafted parentId
    // could splice a comment into another thread.
    let parent: { id: string; userId: string } | null = null;
    if (parentId) {
      const found = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, userId: true, reportId: true, isDeleted: true },
      });
      if (!found || found.reportId !== reportId || found.isDeleted) {
        return { success: false, error: "Komenti të cilit po i përgjigjeni nuk ekziston." };
      }
      parent = { id: found.id, userId: found.userId };
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          reportId,
          userId: user.id,
          parentId: parent?.id ?? null,
          body,
          isOfficial: isMunicipalityStaff(user),
        },
        select: { id: true },
      });
      await tx.report.update({
        where: { id: reportId },
        data: { commentsCount: { increment: 1 } },
      });
      return created;
    });

    // A reply pings the parent author; a top-level comment pings the watchers.
    if (parent) {
      await notify({
        userIds: [parent.userId],
        actorId: user.id,
        reportId,
        type: "COMMENT_REPLIED",
        title: `${user.name} iu përgjigj komentit tuaj`,
        body: truncate(body, 140),
        url: `/reports/${report.slug}#comment-${comment.id}`,
      });
    } else {
      const audience = await getReportAudience(reportId);
      await notify({
        userIds: audience,
        actorId: user.id,
        reportId,
        type: "REPORT_COMMENTED",
        title: `${user.name} komentoi te "${truncate(report.title, 60)}"`,
        body: truncate(body, 140),
        url: `/reports/${report.slug}#comment-${comment.id}`,
      });
    }

    await evaluateBadges(user.id);
    await logActivity({
      userId: user.id,
      action: "comment.create",
      entityType: "comment",
      entityId: comment.id,
      metadata: { reportId },
    });

    revalidatePath(`/reports/${report.slug}`);
    return ok({ id: comment.id }, "Komenti u shtua.");
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Soft delete: the row survives so its replies keep their place in the thread,
 * but the body is cleared and the UI renders a tombstone.
 */
export async function deleteCommentAction(commentId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, isDeleted: true, report: { select: { id: true, slug: true } } },
    });
    if (!comment || comment.isDeleted) return { success: false, error: "Komenti nuk u gjet." };
    if (!canDeleteComment(user, comment)) {
      return { success: false, error: "Nuk keni leje ta fshini këtë koment." };
    }

    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: { isDeleted: true, body: "" },
      }),
      prisma.report.update({
        where: { id: comment.report.id },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);

    await logActivity({
      userId: user.id,
      action: "comment.delete",
      entityType: "comment",
      entityId: commentId,
    });

    revalidatePath(`/reports/${comment.report.slug}`);
    return ok(undefined, "Komenti u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleCommentLikeAction(
  commentId: string
): Promise<ActionResult<{ liked: boolean; likesCount: number }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("vote", user.id);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.commentLike.findUnique({
        where: { commentId_userId: { commentId, userId: user.id } },
      });

      if (existing) {
        await tx.commentLike.delete({ where: { id: existing.id } });
        const comment = await tx.comment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } },
          select: { likesCount: true, report: { select: { slug: true } } },
        });
        return { liked: false, likesCount: comment.likesCount, slug: comment.report.slug };
      }

      await tx.commentLike.create({ data: { commentId, userId: user.id } });
      const comment = await tx.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true, report: { select: { slug: true } } },
      });
      return { liked: true, likesCount: comment.likesCount, slug: comment.report.slug };
    });

    revalidatePath(`/reports/${result.slug}`);
    return ok({ liked: result.liked, likesCount: result.likesCount });
  } catch (error) {
    return toActionError(error);
  }
}
