import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { FileQuestion, Plus, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";
import { getFeed } from "@/server/queries/reports";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ReportCard } from "@/components/reports/report-card";
import { AdSlot } from "@/components/ads/ad-slot";

export const metadata: Metadata = {
  title: "Ballina",
  description: "Raportet më të fundit nga komuna juaj dhe e gjithë Kosova.",
  robots: { index: false, follow: true },
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [user, feed] = await Promise.all([getCurrentUser(), getFeed(page)]);

  const municipality = user?.municipalityId
    ? await prisma.municipality.findUnique({
        where: { id: user.municipalityId },
        select: { name: true, slug: true },
      })
    : null;

  return (
    <div className="container max-w-6xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {municipality ? `Raportet në ${municipality.name}` : "Raportet e fundit"}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {municipality
              ? "Problemet e raportuara nga banorët e komunës suaj."
              : "Çfarë po ndodh në të gjithë Kosovën."}
          </p>
        </div>

        <Button asChild>
          <Link href="/reports/new">
            <Plus /> Raporto problem
          </Link>
        </Button>
      </header>

      {!user?.municipalityId ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-sm">
            Zgjidhni komunën tuaj në cilësime për ta personalizuar këtë ballinë.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">Zgjidh komunën</Link>
          </Button>
        </div>
      ) : null}

      {feed.items.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Ende asnjë raport këtu"
          description={
            municipality
              ? `Askush nuk ka raportuar ende një problem në ${municipality.name}. Bëhuni i pari.`
              : "Bëhuni i pari që raporton një problem publik."
          }
          action={
            <Button asChild>
              <Link href="/reports/new">
                <Plus /> Raporto problemin e parë
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {feed.items.map((report, index) => (
              <Fragment key={report.id}>
                <ReportCard
                  report={report}
                  isAuthenticated={Boolean(user)}
                  priority={index < 3}
                />
                {/* Sits in the natural scroll rhythm rather than interrupting the top. */}
                {index === 2 ? <AdSlot id="feed-inline" /> : null}
              </Fragment>
            ))}
          </div>

          <Pagination page={feed.page} totalPages={feed.totalPages} className="mt-10" />
        </>
      )}
    </div>
  );
}
