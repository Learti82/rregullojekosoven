import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CategoryBreakdown, DashboardStats, TrendPoint } from "@/types";

const OPEN_STATUSES = ["PENDING", "VERIFIED", "ASSIGNED"] as const;

/**
 * Aggregate KPIs for a municipality dashboard (or the whole platform when
 * `municipalityId` is omitted).
 */
export async function getDashboardStats(municipalityId?: string): Promise<DashboardStats> {
  const scope: Prisma.ReportWhereInput = municipalityId ? { municipalityId } : {};
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, open, inProgress, completed, rejected, newThisWeek, resolutionRows] =
    await Promise.all([
      prisma.report.count({ where: scope }),
      prisma.report.count({ where: { ...scope, status: { in: [...OPEN_STATUSES] } } }),
      prisma.report.count({ where: { ...scope, status: "IN_PROGRESS" } }),
      prisma.report.count({ where: { ...scope, status: "COMPLETED" } }),
      prisma.report.count({ where: { ...scope, status: "REJECTED" } }),
      prisma.report.count({ where: { ...scope, createdAt: { gte: weekAgo } } }),
      prisma.report.findMany({
        where: { ...scope, status: "COMPLETED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        orderBy: { resolvedAt: "desc" },
        take: 500,
      }),
    ]);

  const avgResolutionHours =
    resolutionRows.length === 0
      ? null
      : resolutionRows.reduce(
          (sum, row) =>
            sum + (row.resolvedAt!.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60),
          0
        ) / resolutionRows.length;

  const decided = completed + rejected;

  return {
    total,
    open,
    inProgress,
    completed,
    rejected,
    avgResolutionHours,
    resolutionRate: decided === 0 ? 0 : Math.round((completed / decided) * 100),
    newThisWeek,
  };
}

export async function getCategoryBreakdown(
  municipalityId?: string
): Promise<CategoryBreakdown[]> {
  const grouped = await prisma.report.groupBy({
    by: ["categoryId"],
    where: municipalityId ? { municipalityId } : undefined,
    _count: { _all: true },
    orderBy: { _count: { categoryId: "desc" } },
    take: 8,
  });
  if (grouped.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  return grouped.map((row) => ({
    name: byId.get(row.categoryId)?.name ?? "Të tjera",
    color: byId.get(row.categoryId)?.color ?? "#94a3b8",
    count: row._count._all,
  }));
}

/**
 * Daily created vs. completed counts.
 *
 * Grouping by day is done in SQL (`date_trunc`) so the whole series comes back
 * in two round-trips regardless of volume. Both queries are fully
 * parameterised via Prisma's tagged template.
 */
export async function getTrend(days = 30, municipalityId?: string): Promise<TrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const created = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
    FROM "reports"
    WHERE "created_at" >= ${since}
      AND (${municipalityId ?? null}::text IS NULL OR "municipality_id" = ${municipalityId ?? null})
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const completed = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', "resolved_at") AS day, COUNT(*)::bigint AS count
    FROM "reports"
    WHERE "resolved_at" >= ${since}
      AND (${municipalityId ?? null}::text IS NULL OR "municipality_id" = ${municipalityId ?? null})
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const createdMap = new Map(created.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const completedMap = new Map(
    completed.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)])
  );

  // Emit a point per day so the chart has no gaps.
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    points.push({
      date,
      created: createdMap.get(date) ?? 0,
      completed: completedMap.get(date) ?? 0,
    });
  }
  return points;
}

/** Municipality league table for the admin analytics view. */
export async function getMunicipalityLeaderboard(limit = 10) {
  const grouped = await prisma.report.groupBy({
    by: ["municipalityId"],
    _count: { _all: true },
    orderBy: { _count: { municipalityId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.municipalityId);
  const [municipalities, completedGroups] = await Promise.all([
    prisma.municipality.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true },
    }),
    prisma.report.groupBy({
      by: ["municipalityId"],
      where: { municipalityId: { in: ids }, status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const nameById = new Map(municipalities.map((m) => [m.id, m]));
  const completedById = new Map(completedGroups.map((g) => [g.municipalityId, g._count._all]));

  return grouped.map((row) => {
    const total = row._count._all;
    const completed = completedById.get(row.municipalityId) ?? 0;
    return {
      id: row.municipalityId,
      name: nameById.get(row.municipalityId)?.name ?? "—",
      slug: nameById.get(row.municipalityId)?.slug ?? "",
      total,
      completed,
      rate: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });
}

export async function getPlatformCounters() {
  const [reports, users, municipalities, resolved] = await Promise.all([
    prisma.report.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.municipality.count({ where: { isActive: true } }),
    prisma.report.count({ where: { status: "COMPLETED" } }),
  ]);
  return { reports, users, municipalities, resolved };
}
