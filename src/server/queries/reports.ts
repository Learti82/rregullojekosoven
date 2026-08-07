import "server-only";
import { cache } from "react";
import type { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { MAP_PAGE_SIZE, PAGE_SIZE } from "@/lib/constants";
import type { ReportFilters } from "@/validations/report";
import type { MapMarker, Paginated, ReportDetail, ReportListItem } from "@/types";

/** Shared selection so list and detail views stay in sync. */
const listInclude = {
  category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
  municipality: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true, username: true, image: true } },
  images: {
    select: { id: true, url: true, thumbnailUrl: true, caption: true },
    orderBy: { sortOrder: "asc" },
    take: 1,
  },
} satisfies Prisma.ReportInclude;

function rangeToDate(range: ReportFilters["range"]): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(new Date().getFullYear(), 0, 1);
    default:
      return undefined;
  }
}

/**
 * Everything the public may see: approved reports only.
 *
 * Applied as a base in `buildWhere`, so every listing, search, map query and
 * sitemap entry inherits it. Anything that must bypass it (the admin queue, an
 * author viewing their own submission) does so explicitly and visibly.
 */
export const PUBLIC_REPORT_SCOPE = {
  moderationStatus: "APPROVED",
} as const satisfies Prisma.ReportWhereInput;

function buildWhere(filters: Partial<ReportFilters>): Prisma.ReportWhereInput {
  const where: Prisma.ReportWhereInput = { ...PUBLIC_REPORT_SCOPE };

  if (filters.q) {
    // Prisma parameterises these — no string interpolation reaches SQL.
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { address: { contains: filters.q, mode: "insensitive" } },
      { reference: { contains: filters.q, mode: "insensitive" } },
      { municipality: { name: { contains: filters.q, mode: "insensitive" } } },
      { category: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  if (filters.municipality) where.municipality = { slug: filters.municipality };
  if (filters.category) where.category = { slug: filters.category };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  const since = rangeToDate(filters.range ?? "all");
  if (since) where.createdAt = { gte: since };

  return where;
}

function buildOrderBy(sort: ReportFilters["sort"]): Prisma.ReportOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ score: "desc" }, { createdAt: "desc" }];
    case "discussed":
      return [{ commentsCount: "desc" }, { createdAt: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

/**
 * Attach the viewer's own vote/follow state in one extra query rather than a
 * correlated sub-select per row.
 */
async function withViewerState<T extends { id: string }>(
  reports: T[],
  viewerId: string | null
): Promise<(T & { viewerVote: "UPVOTE" | "DOWNVOTE" | null; viewerFollows: boolean })[]> {
  if (!viewerId || reports.length === 0) {
    return reports.map((r) => ({ ...r, viewerVote: null, viewerFollows: false }));
  }
  const ids = reports.map((r) => r.id);
  const [votes, follows] = await Promise.all([
    prisma.vote.findMany({
      where: { userId: viewerId, reportId: { in: ids } },
      select: { reportId: true, type: true },
    }),
    prisma.follower.findMany({
      where: { userId: viewerId, reportId: { in: ids } },
      select: { reportId: true },
    }),
  ]);
  const voteMap = new Map(votes.map((v) => [v.reportId, v.type]));
  const followSet = new Set(follows.map((f) => f.reportId));
  return reports.map((report) => ({
    ...report,
    viewerVote: voteMap.get(report.id) ?? null,
    viewerFollows: followSet.has(report.id),
  }));
}

export async function getReports(
  filters: Partial<ReportFilters> = {},
  options: { pageSize?: number; municipalityId?: string; createdById?: string } = {}
): Promise<Paginated<ReportListItem>> {
  const page = filters.page ?? 1;
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const where: Prisma.ReportWhereInput = { ...buildWhere(filters) };
  if (options.municipalityId) where.municipalityId = options.municipalityId;
  if (options.createdById) where.createdById = options.createdById;

  const [total, rows] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      include: listInclude,
      orderBy: buildOrderBy(filters.sort ?? "recent"),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const viewer = await getCurrentUser();
  const items = (await withViewerState(rows, viewer?.id ?? null)) as ReportListItem[];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

/** Homepage feed: reports from the viewer's municipality first, then national. */
export async function getFeed(page = 1): Promise<Paginated<ReportListItem>> {
  const viewer = await getCurrentUser();
  if (!viewer?.municipalityId) return getReports({ page, sort: "recent" });

  const pageSize = PAGE_SIZE;
  const where: Prisma.ReportWhereInput = {
    ...PUBLIC_REPORT_SCOPE,
    municipalityId: viewer.municipalityId,
  };
  const [total, rows] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      include: listInclude,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = (await withViewerState(rows, viewer.id)) as ReportListItem[];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export const getReportBySlug = cache(async (slug: string): Promise<ReportDetail | null> => {
  const report = await prisma.report.findUnique({
    where: { slug },
    include: {
      ...listInclude,
      images: { orderBy: { sortOrder: "asc" } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: {
          changedBy: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      duplicateOf: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!report) return null;

  const viewer = await getCurrentUser();

  // An unapproved report is visible only to its author and to staff, so people
  // can still see what they submitted while it waits in the queue.
  if (report.moderationStatus !== "APPROVED") {
    const isOwner = viewer?.id === report.createdById;
    const isStaff =
      viewer?.role === "ADMIN" ||
      viewer?.role === "MUNICIPALITY_ADMIN" ||
      viewer?.role === "MUNICIPALITY_EMPLOYEE";
    if (!isOwner && !isStaff) return null;
  }

  const [withState] = await withViewerState([report], viewer?.id ?? null);
  return withState as unknown as ReportDetail;
});

/** Fire-and-forget view counter; failures are irrelevant to the render. */
export async function incrementViewCount(reportId: string): Promise<void> {
  await prisma.report
    .update({ where: { id: reportId }, data: { viewsCount: { increment: 1 } } })
    .catch(() => undefined);
}

export async function getMapMarkers(
  filters: Partial<ReportFilters> = {}
): Promise<MapMarker[]> {
  const where = buildWhere(filters);
  const rows = await prisma.report.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      latitude: true,
      longitude: true,
      status: true,
      score: true,
      createdAt: true,
      category: { select: { color: true, icon: true, name: true } },
      municipality: { select: { name: true } },
      images: { select: { thumbnailUrl: true, url: true }, take: 1, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: MAP_PAGE_SIZE,
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    categoryColor: row.category.color,
    categoryIcon: row.category.icon,
    categoryName: row.category.name,
    municipalityName: row.municipality.name,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
    thumbnailUrl: row.images[0]?.thumbnailUrl ?? row.images[0]?.url ?? null,
  }));
}

/** Same category and municipality, excluding the current report. */
export async function getRelatedReports(report: {
  id: string;
  categoryId: string;
  municipalityId: string;
}): Promise<ReportListItem[]> {
  const rows = await prisma.report.findMany({
    where: {
      ...PUBLIC_REPORT_SCOPE,
      id: { not: report.id },
      categoryId: report.categoryId,
      municipalityId: report.municipalityId,
      status: { notIn: ["REJECTED", "DUPLICATE"] },
    },
    include: listInclude,
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  return rows as ReportListItem[];
}

/**
 * Candidate duplicates: same category, nearby, still open.
 * The bounding box below is ~1km at Kosovo's latitude.
 */
export async function findNearbyReports(params: {
  latitude: number;
  longitude: number;
  categoryId?: string;
  excludeId?: string;
  radiusKm?: number;
}) {
  const radius = params.radiusKm ?? 0.5;
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos((params.latitude * Math.PI) / 180));

  return prisma.report.findMany({
    where: {
      ...PUBLIC_REPORT_SCOPE,
      id: params.excludeId ? { not: params.excludeId } : undefined,
      categoryId: params.categoryId,
      status: { notIn: ["REJECTED", "DUPLICATE", "COMPLETED"] },
      latitude: { gte: params.latitude - latDelta, lte: params.latitude + latDelta },
      longitude: { gte: params.longitude - lngDelta, lte: params.longitude + lngDelta },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      images: { select: { url: true, thumbnailUrl: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export async function getReportsByStatusCount(municipalityId?: string) {
  const grouped = await prisma.report.groupBy({
    by: ["status"],
    where: municipalityId
      ? { ...PUBLIC_REPORT_SCOPE, municipalityId }
      : { ...PUBLIC_REPORT_SCOPE },
    _count: { _all: true },
  });
  return grouped.reduce<Record<ReportStatus, number>>(
    (acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    },
    {
      PENDING: 0,
      VERIFIED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      REJECTED: 0,
      DUPLICATE: 0,
    }
  );
}

/** Slugs for the sitemap. */
export async function getAllReportSlugs(limit = 10000) {
  return prisma.report.findMany({
    where: { ...PUBLIC_REPORT_SCOPE, status: { notIn: ["REJECTED", "DUPLICATE"] } },
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * The administrator's approval queue: submissions awaiting a decision, oldest
 * first so nothing is left behind.
 */
export async function getModerationQueue(page = 1, pageSize = 20) {
  const where: Prisma.ReportWhereInput = { moderationStatus: "PENDING_REVIEW" };

  const [total, rows] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      include: {
        ...listInclude,
        images: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items: rows, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export async function getPendingModerationCount(): Promise<number> {
  return prisma.report.count({ where: { moderationStatus: "PENDING_REVIEW" } });
}

/** Reports the signed-in user submitted that are still awaiting a decision. */
export async function getOwnPendingReports(userId: string) {
  return prisma.report.findMany({
    where: { createdById: userId, moderationStatus: { not: "APPROVED" } },
    select: {
      id: true,
      slug: true,
      title: true,
      moderationStatus: true,
      moderationNote: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
