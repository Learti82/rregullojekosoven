"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { markNotificationsRead } from "@/lib/notifications";
import { ok, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const result = await markNotificationsRead(user.id);
    revalidatePath("/notifications");
    return ok({ count: result.count }, "Të gjitha njoftimet u shënuan si të lexuara.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    // Scoped by userId so one user cannot mark another's notification.
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteNotificationAction(
  notificationId: string
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    await prisma.notification.deleteMany({ where: { id: notificationId, userId: user.id } });
    revalidatePath("/notifications");
    return ok(undefined, "Njoftimi u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearReadNotificationsAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const result = await prisma.notification.deleteMany({
      where: { userId: user.id, readAt: { not: null } },
    });
    revalidatePath("/notifications");
    return ok({ count: result.count }, "Njoftimet e lexuara u pastruan.");
  } catch (error) {
    return toActionError(error);
  }
}
