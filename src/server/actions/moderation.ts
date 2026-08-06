"use server";

import { revalidatePath } from "next/cache";
import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageReport, requireUser, isAdmin } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { REPORT_STATUS_META, STATUS_TRANSITIONS } from "@/lib/constants";
import { getReportAudience, notify } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";
import { isOwnedStorageUrl } from "@/lib/storage";
import { truncate } from "@/lib/utils";
import { assignReportSchema, internalNoteSchema, updateStatusSchema } from "@/validations/report";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

/**
 * Move a report through the municipal workflow.
 *
 * Three gates apply, in order: the caller must manage the report's
 * municipality, the transition must be in `STATUS_TRANSITIONS`, and the change
 * plus its history entry and counters are written in one transaction.
 */
export async function updateReportStatusAction(
  _prev: ActionResult<{ status: ReportStatus }> | null,
  formData: FormData
): Promise<ActionResult<{ status: ReportStatus }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("statusChange", user.id);

    const rawImages = formData.get("images");
    const parsed = parseInput(updateStatusSchema, {
      reportId: formData.get("reportId"),
      status: formData.get("status"),
      note: formData.get("note") ?? "",
      duplicateOfId: formData.get("duplicateOfId") ?? "",
      images: rawImages ? JSON.parse(String(rawImages)) : [],
    });
    if (!parsed.ok) return parsed.result;

    const { reportId, status, note, duplicateOfId, images } = parsed.data;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        municipalityId: true,
        createdById: true,
      },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };

    if (!canManageReport(user, report)) {
      return { success: false, error: "Nuk keni leje të menaxhoni raportet e kësaj komune." };
    }

    if (report.status === status) {
      return { success: false, error: "Raporti është tashmë në këtë status." };
    }

    const allowed = STATUS_TRANSITIONS[report.status] ?? [];
    if (!allowed.includes(status) && !isAdmin(user)) {
      return {
        success: false,
        error: `Kalimi nga "${REPORT_STATUS_META[report.status].label}" në "${REPORT_STATUS_META[status].label}" nuk lejohet.`,
      };
    }

    if (images.some((image) => !isOwnedStorageUrl(image.url))) {
      return { success: false, error: "Një ose më shumë imazhe nuk janë të vlefshme." };
    }

    if (status === "DUPLICATE" && duplicateOfId) {
      const original = await prisma.report.findUnique({
        where: { id: duplicateOfId },
        select: { id: true },
      });
      if (!original || original.id === reportId) {
        return { success: false, error: "Raporti origjinal nuk është i vlefshëm." };
      }
    }

    const isCompletion = status === "COMPLETED";

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status,
          reviewedById: user.id,
          duplicateOfId: status === "DUPLICATE" ? duplicateOfId || null : null,
          rejectionReason: status === "REJECTED" ? note || null : null,
          resolvedAt: isCompletion ? new Date() : null,
          resolutionNote: isCompletion ? note || null : null,
          ...(images.length > 0
            ? {
                images: {
                  create: images.map((image, index) => ({
                    url: image.url,
                    key: image.key,
                    sizeBytes: image.sizeBytes,
                    mimeType: image.mimeType,
                    width: image.width,
                    height: image.height,
                    caption: image.caption || null,
                    kind: isCompletion ? ("COMPLETION" as const) : ("PROGRESS" as const),
                    sortOrder: 100 + index,
                    uploadedById: user.id,
                  })),
                },
              }
            : {}),
        },
      });

      await tx.statusHistory.create({
        data: {
          reportId,
          fromStatus: report.status,
          toStatus: status,
          changedById: user.id,
          note: note || null,
        },
      });

      if (isCompletion) {
        await tx.profile.updateMany({
          where: { userId: report.createdById },
          data: { resolvedCount: { increment: 1 } },
        });
        // Close any assignment still open on this report.
        await tx.employeeAssignment.updateMany({
          where: { reportId, status: { in: ["OPEN", "IN_PROGRESS"] } },
          data: { status: "DONE", completedAt: new Date() },
        });
      }
    });

    const audience = await getReportAudience(reportId);
    await notify({
      userIds: audience,
      actorId: user.id,
      reportId,
      type: isCompletion ? "REPORT_COMPLETED" : "REPORT_STATUS_CHANGED",
      title: isCompletion
        ? `Raporti "${truncate(report.title, 60)}" u zgjidh`
        : `Statusi u ndryshua në "${REPORT_STATUS_META[status].label}"`,
      body: note || REPORT_STATUS_META[status].description,
      url: `/reports/${report.slug}`,
    });

    if (isCompletion) await evaluateBadges(report.createdById);

    await logActivity({
      userId: user.id,
      action: "report.status_change",
      entityType: "report",
      entityId: reportId,
      metadata: { from: report.status, to: status },
    });

    revalidatePath(`/reports/${report.slug}`);
    revalidatePath("/municipality");
    revalidatePath("/explore");
    revalidatePath("/map");

    return ok({ status }, `Statusi u përditësua në "${REPORT_STATUS_META[status].label}".`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function assignReportAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const dueAtRaw = formData.get("dueAt");
    const parsed = parseInput(assignReportSchema, {
      reportId: formData.get("reportId"),
      assigneeId: formData.get("assigneeId"),
      note: formData.get("note") ?? "",
      ...(dueAtRaw ? { dueAt: dueAtRaw } : {}),
    });
    if (!parsed.ok) return parsed.result;

    const { reportId, assigneeId, note, dueAt } = parsed.data;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, slug: true, title: true, status: true, municipalityId: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };
    if (!canManageReport(user, report)) {
      return { success: false, error: "Nuk keni leje të menaxhoni raportet e kësaj komune." };
    }

    // The assignee must be staff of the same municipality as the report.
    const assignee = await prisma.user.findFirst({
      where: {
        id: assigneeId,
        isActive: true,
        municipalityId: report.municipalityId,
        role: { name: { in: ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN"] } },
      },
      select: { id: true, name: true },
    });
    if (!assignee) {
      return { success: false, error: "Punonjësi nuk i përket kësaj komune." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeAssignment.create({
        data: {
          reportId,
          assigneeId,
          assignedById: user.id,
          municipalityId: report.municipalityId,
          note: note || null,
          dueAt: dueAt ?? null,
        },
      });

      if (report.status === "PENDING" || report.status === "VERIFIED") {
        await tx.report.update({ where: { id: reportId }, data: { status: "ASSIGNED" } });
        await tx.statusHistory.create({
          data: {
            reportId,
            fromStatus: report.status,
            toStatus: "ASSIGNED",
            changedById: user.id,
            note: `Caktuar te ${assignee.name}.`,
          },
        });
      }
    });

    await notify({
      userIds: [assigneeId],
      actorId: user.id,
      reportId,
      type: "ASSIGNMENT_CREATED",
      title: "Ju është caktuar një raport i ri",
      body: report.title,
      url: `/reports/${report.slug}`,
    });

    await logActivity({
      userId: user.id,
      action: "report.assign",
      entityType: "report",
      entityId: reportId,
      metadata: { assigneeId },
    });

    revalidatePath(`/reports/${report.slug}`);
    revalidatePath("/municipality");
    return ok(undefined, `Raporti iu caktua ${assignee.name}.`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function addInternalNoteAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const parsed = parseInput(internalNoteSchema, {
      reportId: formData.get("reportId"),
      body: formData.get("body"),
    });
    if (!parsed.ok) return parsed.result;

    const report = await prisma.report.findUnique({
      where: { id: parsed.data.reportId },
      select: { id: true, slug: true, municipalityId: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };
    if (!canManageReport(user, report)) {
      return { success: false, error: "Vetëm stafi komunal mund të shtojë shënime të brendshme." };
    }

    await prisma.internalNote.create({
      data: { reportId: report.id, authorId: user.id, body: parsed.data.body },
    });

    await logActivity({
      userId: user.id,
      action: "report.internal_note",
      entityType: "report",
      entityId: report.id,
    });

    revalidatePath(`/reports/${report.slug}`);
    return ok(undefined, "Shënimi u ruajt.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateAssignmentStatusAction(
  assignmentId: string,
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const assignment = await prisma.employeeAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        assigneeId: true,
        municipalityId: true,
        report: { select: { slug: true } },
      },
    });
    if (!assignment) return { success: false, error: "Detyra nuk u gjet." };

    const canUpdate =
      assignment.assigneeId === user.id ||
      canManageReport(user, { municipalityId: assignment.municipalityId });
    if (!canUpdate) return { success: false, error: "Nuk keni leje për këtë detyrë." };

    await prisma.employeeAssignment.update({
      where: { id: assignmentId },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });

    revalidatePath(`/reports/${assignment.report.slug}`);
    revalidatePath("/municipality/assignments");
    return ok(undefined, "Detyra u përditësua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function togglePinReportAction(reportId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, slug: true, isPinned: true, municipalityId: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };
    if (!canManageReport(user, report)) {
      return { success: false, error: "Nuk keni leje për këtë veprim." };
    }

    await prisma.report.update({
      where: { id: reportId },
      data: { isPinned: !report.isPinned },
    });

    revalidatePath("/feed");
    revalidatePath(`/reports/${report.slug}`);
    return ok(undefined, report.isPinned ? "Raporti u hoq nga të fiksuarat." : "Raporti u fiksua.");
  } catch (error) {
    return toActionError(error);
  }
}
