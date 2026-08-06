import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";
import { getAllReportSlugs } from "@/server/queries/reports";
import { getMunicipalities, getCategories } from "@/server/queries/taxonomy";

/**
 * Generated on request and cached for an hour, rather than at build time.
 *
 * As a build-time route this reached for the database during `next build`. On a
 * fresh deployment — or whenever a managed database is asleep or briefly
 * unreachable — the query failed, the catch below swallowed it, and the
 * deployment silently shipped a sitemap containing only the static routes, with
 * every report URL missing until the next build. Rendering per request means a
 * transient failure costs one cached response, not a whole deploy cycle, and
 * newly published reports appear within the hour instead of at the next build.
 */
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/explore"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/map"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // A cold or unreachable database must not break the sitemap response.
  try {
    const [reports, municipalities, categories] = await Promise.all([
      getAllReportSlugs(5000),
      getMunicipalities(),
      getCategories(),
    ]);

    return [
      ...staticRoutes,
      ...municipalities.map((municipality) => ({
        url: absoluteUrl(`/explore?municipality=${municipality.slug}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...categories.map((category) => ({
        url: absoluteUrl(`/explore?category=${category.slug}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
      ...reports.map((report) => ({
        url: absoluteUrl(`/reports/${report.slug}`),
        lastModified: report.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    console.error("[sitemap]", error);
    return staticRoutes;
  }
}
