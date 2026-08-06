import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

/**
 * Badge evaluation.
 *
 * Runs after actions that change a user's counters. Awards are idempotent —
 * the unique (userId, badgeId) constraint plus `skipDuplicates` mean repeated
 * evaluation never double-awards or notifies twice.
 */

export type BadgeKind = "REPORTS" | "VOTES" | "RESOLVED" | "COMMENTS";

export async function evaluateBadges(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string[]> {
  const [profile, commentsCount, badges, owned] = await Promise.all([
    client.profile.findUnique({ where: { userId } }),
    client.comment.count({ where: { userId, isDeleted: false } }),
    client.badge.findMany(),
    client.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
  ]);
  if (!profile) return [];

  const ownedIds = new Set(owned.map((b) => b.badgeId));
  const metrics: Record<BadgeKind, number> = {
    REPORTS: profile.reportsCount,
    VOTES: profile.votesReceived,
    RESOLVED: profile.resolvedCount,
    COMMENTS: commentsCount,
  };

  const earned = badges.filter(
    (badge) =>
      !ownedIds.has(badge.id) && (metrics[badge.kind as BadgeKind] ?? 0) >= badge.threshold
  );
  if (earned.length === 0) return [];

  await client.userBadge.createMany({
    data: earned.map((badge) => ({ userId, badgeId: badge.id })),
    skipDuplicates: true,
  });

  await notify(
    {
      userIds: [userId],
      type: "BADGE_EARNED",
      title: earned.length === 1 ? `Fituat distinktivin "${earned[0]!.name}"` : "Fituat distinktivë të rinj",
      body: earned.map((b) => b.name).join(", "),
      url: "/settings",
    },
    client
  );

  return earned.map((badge) => badge.slug);
}
