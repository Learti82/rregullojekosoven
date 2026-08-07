import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { NOTIFICATIONS_PAGE_SIZE, PAGE_SIZE } from "@/lib/constants";
import type { NotificationItem, Paginated } from "@/types";

export const getProfileByUsername = cache(async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      createdAt: true,
      isActive: true,
      isBanned: true,
      role: { select: { name: true, label: true } },
      municipality: { select: { id: true, name: true, slug: true } },
      profile: true,
      badges: {
        orderBy: { earnedAt: "desc" },
        include: { badge: true },
      },
      _count: {
        select: {
          // Only approved reports count publicly, so the headline number on a
          // profile matches the list of reports underneath it.
          reports: { where: { moderationStatus: "APPROVED" } },
          comments: true,
          votes: true,
        },
      },
    },
  });
  if (!user || !user.isActive || user.isBanned) return null;
  return user;
});

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getProfileByUsername>>>;

export const getCurrentUserSettings = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,
      municipalityId: true,
      role: { select: { name: true, label: true } },
      profile: true,
    },
  })
);

export async function getNotifications(
  userId: string,
  page = 1
): Promise<Paginated<NotificationItem>> {
  const pageSize = NOTIFICATIONS_PAGE_SIZE;
  const [total, items] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      include: {
        actor: { select: { id: true, name: true, username: true, image: true } },
        report: { select: { id: true, slug: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

/** Users a municipality can assign work to. */
export const getMunicipalityStaff = cache(async (municipalityId: string) =>
  prisma.user.findMany({
    where: {
      municipalityId,
      isActive: true,
      role: { name: { in: ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN"] } },
    },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      role: { select: { name: true, label: true } },
      _count: { select: { assignmentsOwned: true } },
    },
    orderBy: { name: "asc" },
  })
);

export async function getAdminUsers(params: {
  q?: string;
  role?: string;
  municipality?: string;
  page?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = PAGE_SIZE * 2;
  const where = {
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { email: { contains: params.q, mode: "insensitive" as const } },
            { username: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.role ? { role: { name: params.role as never } } : {}),
    ...(params.municipality ? { municipality: { slug: params.municipality } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        isActive: true,
        isBanned: true,
        bannedReason: true,
        createdAt: true,
        lastLoginAt: true,
        role: { select: { name: true, label: true } },
        municipality: { select: { id: true, name: true } },
        _count: { select: { reports: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export async function getActivityLogs(page = 1) {
  const pageSize = 30;
  const [total, items] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      include: { user: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export const getUserBadges = cache(async (userId: string) =>
  prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: "desc" },
  })
);
