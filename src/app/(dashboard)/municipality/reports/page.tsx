import type { Metadata } from "next";
import Link from "next/link";
import { FileX } from "lucide-react";
import { requireMunicipalityScope } from "@/lib/permissions";
import { getReports } from "@/server/queries/reports";
import { getCategories, getMunicipalities } from "@/server/queries/taxonomy";
import { reportFiltersSchema } from "@/validations/report";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PriorityBadge, StatusBadge } from "@/components/reports/status-badge";
import { ReportFilters } from "@/components/reports/report-filters";

export const metadata: Metadata = {
  title: "Raportet e komunës",
  robots: { index: false, follow: false },
};

export default async function MunicipalityReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireMunicipalityScope();
  const raw = await searchParams;
  const parsed = reportFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const [result, municipalities, categories] = await Promise.all([
    getReports(filters, {
      municipalityId: user.scopedMunicipalityId ?? undefined,
      pageSize: 20,
    }),
    getMunicipalities(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Raportet</h1>
        <p className="mt-1.5 text-muted-foreground">
          {formatNumber(result.total)} raporte në juridiksionin tuaj.
        </p>
      </header>

      <ReportFilters
        municipalities={municipalities}
        categories={categories}
        showStatus
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={FileX}
          title="Asnjë raport"
          description="Nuk ka raporte që përputhen me filtrat e zgjedhur."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Lista e raporteve të komunës</caption>
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Raporti</th>
                  <th scope="col" className="px-4 py-3 font-medium">Kategoria</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statusi</th>
                  <th scope="col" className="px-4 py-3 font-medium">Prioriteti</th>
                  <th scope="col" className="px-4 py-3 font-medium">Vota</th>
                  <th scope="col" className="px-4 py-3 font-medium">Krijuar</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Veprime</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.items.map((report) => (
                  <tr key={report.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports/${report.slug}`}
                        className="line-clamp-1 font-medium hover:text-primary"
                      >
                        {report.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{report.reference}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: report.category.color }}
                          aria-hidden
                        />
                        {report.category.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} showDot={false} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={report.priority} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{report.score}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/reports/${report.slug}`}>Menaxho</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={result.page} totalPages={result.totalPages} />
        </>
      )}
    </div>
  );
}
