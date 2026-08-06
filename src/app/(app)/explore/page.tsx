import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import Link from "next/link";
import { Megaphone, SearchX, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";
import { getReports } from "@/server/queries/reports";
import { getCategories, getMunicipalities } from "@/server/queries/taxonomy";
import { reportFiltersSchema } from "@/validations/report";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportCard, ReportCardSkeleton } from "@/components/reports/report-card";
import { ReportFilters } from "@/components/reports/report-filters";
import { AdSlot } from "@/components/ads/ad-slot";

export const metadata: Metadata = {
  title: "Eksploro raportet",
  description:
    "Kërkoni dhe filtroni të gjitha problemet publike të raportuara në Kosovë sipas komunës, kategorisë dhe statusit.",
  alternates: { canonical: "/explore" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ReportGrid({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  // Unknown or malformed query values fall back to defaults rather than 500.
  const parsed = reportFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const [user, result] = await Promise.all([getCurrentUser(), getReports(filters)]);

  if (result.items.length === 0) {
    // "Try removing filters" is wrong advice when none are applied — which is
    // the case for every visitor before the first report is filed.
    const hasFilters = Boolean(
      filters.q || filters.municipality || filters.category || filters.status ||
        filters.priority || (filters.range && filters.range !== "all")
    );

    return (
      <EmptyState
        icon={hasFilters ? SearchX : Megaphone}
        title={hasFilters ? "Asnjë raport nuk përputhet" : "Ende asnjë raport i publikuar"}
        description={
          hasFilters
            ? "Provoni të hiqni disa filtra ose të kërkoni me fjalë të tjera."
            : "Platforma sapo ka nisur. Bëhuni i pari që raporton një problem në komunën tuaj."
        }
        action={
          <Button asChild>
            <Link href="/reports/new">
              <Plus /> {hasFilters ? "Raporto një problem" : "Raporto problemin e parë"}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {formatNumber(result.total)} raporte
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((report, index) => (
          <Fragment key={report.id}>
            <ReportCard
              report={report}
              isAuthenticated={Boolean(user)}
              priority={index < 3}
            />
            {index === 4 ? <AdSlot id="explore-inline" /> : null}
          </Fragment>
        ))}
      </div>

      <Pagination page={result.page} totalPages={result.totalPages} className="mt-10" />
    </>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const [municipalities, categories] = await Promise.all([getMunicipalities(), getCategories()]);

  return (
    <div className="container max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Eksploro raportet</h1>
        <p className="mt-1.5 text-muted-foreground">
          Kërko dhe filtro të gjitha problemet e raportuara në Kosovë.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-10 w-full rounded-lg" />}>
        <ReportFilters municipalities={municipalities} categories={categories} />
      </Suspense>

      <div className="mt-8">
        <Suspense
          key={JSON.stringify(await searchParams)}
          fallback={
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ReportCardSkeleton key={index} />
              ))}
            </div>
          }
        >
          <ReportGrid searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
