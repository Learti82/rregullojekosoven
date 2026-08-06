import type { Metadata } from "next";
import Link from "next/link";
import { FileX } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { getReports } from "@/server/queries/reports";
import { getCategories, getMunicipalities } from "@/server/queries/taxonomy";
import { reportFiltersSchema } from "@/validations/report";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/reports/status-badge";
import { ReportFilters } from "@/components/reports/report-filters";
import { AdminDeleteReportButton } from "@/components/dashboard/admin-delete-report";

export const metadata: Metadata = {
  title: "Menaxhimi i raporteve",
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const raw = await searchParams;
  const parsed = reportFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const [result, municipalities, categories] = await Promise.all([
    getReports(filters, { pageSize: 20 }),
    getMunicipalities(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Raportet</h1>
        <p className="mt-1.5 text-muted-foreground">
          {formatNumber(result.total)} raporte në të gjithë platformën.
        </p>
      </header>

      <ReportFilters municipalities={municipalities} categories={categories} />

      {result.items.length === 0 ? (
        <EmptyState icon={FileX} title="Asnjë raport" description="Provoni filtra të tjerë." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Të gjitha raportet</caption>
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Raporti</th>
                  <th scope="col" className="px-4 py-3 font-medium">Komuna</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statusi</th>
                  <th scope="col" className="px-4 py-3 font-medium">Autori</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{report.municipality.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} showDot={false} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.isAnonymous ? "Anonim" : report.createdBy.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/reports/${report.slug}`}>Hap</Link>
                        </Button>
                        <AdminDeleteReportButton id={report.id} title={report.title} />
                      </div>
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
