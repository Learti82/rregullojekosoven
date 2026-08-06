import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Timer,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMunicipalityScope } from "@/lib/permissions";
import {
  getCategoryBreakdown,
  getDashboardStats,
  getTrend,
} from "@/server/queries/stats";
import { getMapMarkers, getReports } from "@/server/queries/reports";
import { formatDuration, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/reports/status-badge";
import { TrendChart, CategoryChart } from "@/components/dashboard/charts";
import { ReportsMap } from "@/components/map/dynamic-map";

export const metadata: Metadata = {
  title: "Paneli komunal",
  robots: { index: false, follow: false },
};

export default async function MunicipalityDashboardPage() {
  const user = await requireMunicipalityScope();
  const municipalityId = user.scopedMunicipalityId ?? undefined;

  const [municipality, stats, categories, trend, markers, queue] = await Promise.all([
    municipalityId
      ? prisma.municipality.findUnique({
          where: { id: municipalityId },
          select: { name: true, latitude: true, longitude: true, zoom: true },
        })
      : Promise.resolve(null),
    getDashboardStats(municipalityId),
    getCategoryBreakdown(municipalityId),
    getTrend(30, municipalityId),
    getMapMarkers(municipalityId ? {} : {}),
    getReports(
      { status: "PENDING", sort: "recent" },
      { municipalityId, pageSize: 6 }
    ),
  ]);

  const scopedMarkers = municipalityId
    ? markers.filter((marker) => marker.municipalityName === municipality?.name)
    : markers;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/*
            The municipality name is shown on its own rather than in a
            "Komuna e X" phrase: Albanian puts the place name in the genitive
            there (Prishtinë -> Prishtinës, Prizren -> Prizrenit, Ferizaj ->
            Ferizajt), and the form differs per name. Interpolating the
            nominative would be visibly wrong to every user.
          */}
          {municipality ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Komuna
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {municipality ? municipality.name : "Të gjitha komunat"}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Përmbledhje e problemeve të raportuara dhe performancës së zgjidhjes.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/municipality/reports">Menaxho raportet</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Raporte gjithsej"
          value={formatNumber(stats.total)}
          hint={`${formatNumber(stats.newThisWeek)} këtë javë`}
          icon={FileText}
        />
        <StatCard
          label="Probleme të hapura"
          value={formatNumber(stats.open)}
          hint="Në pritje, të verifikuara ose të caktuara"
          icon={AlertCircle}
          accent="warning"
        />
        <StatCard
          label="Në proces"
          value={formatNumber(stats.inProgress)}
          hint="Punimet kanë filluar"
          icon={Clock}
          accent="primary"
        />
        <StatCard
          label="Të zgjidhura"
          value={formatNumber(stats.completed)}
          hint={`${stats.resolutionRate}% shkallë zgjidhjeje`}
          icon={CheckCircle2}
          accent="success"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Koha mesatare e zgjidhjes"
          value={formatDuration(stats.avgResolutionHours)}
          hint="Mesatarja e 500 raporteve të fundit të zgjidhura"
          icon={Timer}
        />
        <StatCard
          label="Shkalla e zgjidhjes"
          value={`${stats.resolutionRate}%`}
          hint="Raporte të zgjidhura kundrejt atyre të vendosura"
          icon={TrendingUp}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktiviteti (30 ditët e fundit)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sipas kategorisë</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categories} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Harta e problemeve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-hidden rounded-lg border">
            <ReportsMap
              markers={scopedMarkers}
              center={
                municipality ? [municipality.latitude, municipality.longitude] : undefined
              }
              zoom={municipality?.zoom ?? undefined}
            />
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="queue-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="queue-heading" className="font-display text-xl font-semibold">
            Radha e verifikimit
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/municipality/reports?status=PENDING">Shiko të gjitha</Link>
          </Button>
        </div>

        {queue.items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Radha është bosh"
            description="Të gjitha raportet janë verifikuar. Punë e mirë."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {queue.items.map((report) => (
              <li key={report.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/reports/${report.slug}`}
                    className="line-clamp-1 font-medium hover:text-primary"
                  >
                    {report.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {report.reference} · {report.category.name} ·{" "}
                    {report.address ?? report.municipality.name}
                  </p>
                </div>
                <StatusBadge status={report.status} showDot={false} />
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.slug}`}>Shqyrto</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
