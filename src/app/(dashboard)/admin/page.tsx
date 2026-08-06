import type { Metadata } from "next";
import { Building2, CheckCircle2, FileText, Timer, Users } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import {
  getCategoryBreakdown,
  getDashboardStats,
  getMunicipalityLeaderboard,
  getPlatformCounters,
  getTrend,
} from "@/server/queries/stats";
import { formatDuration, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { CategoryChart, TrendChart } from "@/components/dashboard/charts";

export const metadata: Metadata = {
  title: "Analitika e platformës",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const [counters, stats, categories, trend, leaderboard] = await Promise.all([
    getPlatformCounters(),
    getDashboardStats(),
    getCategoryBreakdown(),
    getTrend(30),
    getMunicipalityLeaderboard(10),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Analitika e platformës</h1>
        <p className="mt-1.5 text-muted-foreground">
          Pamje e përgjithshme e aktivitetit në të gjitha komunat.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Raporte gjithsej" value={formatNumber(counters.reports)} icon={FileText} />
        <StatCard
          label="Të zgjidhura"
          value={formatNumber(counters.resolved)}
          hint={`${stats.resolutionRate}% shkallë zgjidhjeje`}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard label="Përdorues aktivë" value={formatNumber(counters.users)} icon={Users} />
        <StatCard
          label="Komuna aktive"
          value={formatNumber(counters.municipalities)}
          icon={Building2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Koha mesatare e zgjidhjes"
          value={formatDuration(stats.avgResolutionHours)}
          icon={Timer}
        />
        <StatCard
          label="Raporte të reja këtë javë"
          value={formatNumber(stats.newThisWeek)}
          icon={FileText}
          accent="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktiviteti kombëtar (30 ditë)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategoritë kryesore</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categories} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performanca sipas komunës</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ende nuk ka të dhëna.
            </p>
          ) : (
            <ul className="space-y-4">
              {leaderboard.map((item) => (
                <li key={item.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatNumber(item.completed)}/{formatNumber(item.total)} ({item.rate}%)
                    </span>
                  </div>
                  <Progress value={item.rate} aria-label={`Shkalla e zgjidhjes: ${item.rate}%`} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
