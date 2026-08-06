import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Municipalities and categories change rarely but are read on nearly every
 * page, so they are cached for an hour and tagged for targeted invalidation
 * from the admin actions.
 */

export const getMunicipalities = unstable_cache(
  async () =>
    prisma.municipality.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        latitude: true,
        longitude: true,
        zoom: true,
        population: true,
      },
    }),
  ["municipalities"],
  { revalidate: 3600, tags: ["municipalities"] }
);

export const getCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        color: true,
      },
    }),
  ["categories"],
  { revalidate: 3600, tags: ["categories"] }
);

export const getMunicipalityBySlug = cache(async (slug: string) =>
  prisma.municipality.findUnique({ where: { slug } })
);

/** Includes inactive rows — the admin tables need to see everything. */
export const getAllMunicipalities = cache(async () =>
  prisma.municipality.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { reports: true, users: true } } },
  })
);

export const getAllCategories = cache(async () =>
  prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { reports: true } } },
  })
);
