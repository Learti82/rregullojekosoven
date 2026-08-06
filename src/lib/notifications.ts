import "server-only";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Notification fan-out.
 *
 * Writes are batched with `createMany` and always exclude the actor, so nobody
 * is notified about their own action. Delivery is best-effort: a failure here
 * must never roll back the domain write that triggered it, so callers pass the
 * surrounding transaction client when they want atomicity and omit it when they
 * do not.
 */

type NotifyInput = {
  userIds: string[];
  actorId?: string | null;
  reportId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  url?: string;
};

export async function notify(
  input: NotifyInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const recipients = Array.from(new Set(input.userIds)).filter(
    (id) => id && id !== input.actorId
  );
  if (recipients.length === 0) return 0;

  const result = await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: input.actorId ?? null,
      reportId: input.reportId ?? null,
      type: input.type,
      title: input.title.slice(0, 160),
      body: input.body?.slice(0, 500),
      url: input.url?.slice(0, 500),
    })),
  });
  return result.count;
}

/** Everyone watching a report: the author plus explicit followers. */
export async function getReportAudience(
  reportId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string[]> {
  const [report, followers] = await Promise.all([
    client.report.findUnique({ where: { id: reportId }, select: { createdById: true } }),
    client.follower.findMany({ where: { reportId }, select: { userId: true } }),
  ]);
  const ids = followers.map((f) => f.userId);
  if (report) ids.push(report.createdById);
  return Array.from(new Set(ids));
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  return prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
