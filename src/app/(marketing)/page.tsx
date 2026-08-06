import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { formatCompact } from "@/lib/utils";
import { getPlatformCounters } from "@/server/queries/stats";
import { getReports } from "@/server/queries/reports";
import { getCategories } from "@/server/queries/taxonomy";
import { getCurrentUser } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportCard } from "@/components/reports/report-card";
import { FadeIn } from "@/components/marketing/fade-in";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * Rendered per request: the hero CTA and the report cards depend on whether the
 * visitor is signed in, so this route reads cookies and cannot be static. The
 * expensive parts underneath — municipalities and categories — are cached for
 * an hour by `unstable_cache`, so the per-request cost stays small.
 */
export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Camera,
    title: "Fotografo problemin",
    description:
      "Bëj një foto me telefon. Vendndodhja kapet automatikisht ose e zgjedh vetë në hartë.",
  },
  {
    icon: MessageSquare,
    title: "Përshkruaje shkurt",
    description:
      "Zgjedh kategorinë, shto një përshkrim dhe publikoje. Të gjitha të dhënat shkojnë te komuna përgjegjëse.",
  },
  {
    icon: Users,
    title: "Bashkoni zërat",
    description:
      "Qytetarët votojnë dhe komentojnë. Problemet me më shumë vota marrin prioritet më të lartë.",
  },
  {
    icon: CheckCircle2,
    title: "Ndiq zgjidhjen",
    description:
      "Komuna përditëson statusin dhe ngarkon prova të punës së kryer. Ti njoftohesh në çdo hap.",
  },
] as const;

export default async function LandingPage() {
  const [counters, latest, categories, user] = await Promise.all([
    getPlatformCounters(),
    getReports({ sort: "popular" }, { pageSize: 3 }),
    getCategories(),
    getCurrentUser(),
  ]);

  const stats = [
    { label: "Raporte të dërguara", value: formatCompact(counters.reports) },
    { label: "Probleme të zgjidhura", value: formatCompact(counters.resolved) },
    { label: "Qytetarë aktivë", value: formatCompact(counters.users) },
    { label: "Komuna të mbuluara", value: formatCompact(counters.municipalities) },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, hsl(var(--primary)) 0, transparent 45%), radial-gradient(circle at 80% 60%, hsl(var(--chart-2)) 0, transparent 40%)",
          }}
          aria-hidden
        />

        <div className="container py-20 md:py-28">
          <FadeIn className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              Platformë qytetare për të gjitha komunat e Kosovës
            </span>

            <h1 className="text-balance mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Raporto problemin.{" "}
              <span className="bg-gradient-to-br from-primary to-chart-2 bg-clip-text text-transparent">
                Ndrysho qytetin.
              </span>
            </h1>

            <p className="text-balance mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Një gropë në rrugë, një llambë e prishur, mbeturina të pagrumbulluara. Raportoje për
              30 sekonda dhe ndiqe deri në zgjidhje — publikisht, me përgjegjësi të qartë.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href={user ? "/reports/new" : "/register"}>
                  Raporto një problem
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/map">
                  <MapPin /> Shiko hartën
                </Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="p-5 text-center">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 font-display text-3xl font-semibold tabular-nums">
                    {stat.value}
                  </dd>
                </Card>
              ))}
            </dl>
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b py-20" aria-labelledby="how-it-works">
        <div className="container">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <h2 id="how-it-works" className="font-display text-3xl font-bold tracking-tight">
              Si funksionon
            </h2>
            <p className="mt-3 text-muted-foreground">
              Katër hapa nga problemi te zgjidhja — pa zyra, pa radhë, pa letra.
            </p>
          </FadeIn>

          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.08} asChild>
                <li>
                  <Card className="h-full p-6">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                      <step.icon className="size-5 text-primary" aria-hidden />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">
                      Hapi {index + 1}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </Card>
                </li>
              </FadeIn>
            ))}
          </ol>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b bg-muted/30 py-20" aria-labelledby="categories-heading">
        <div className="container">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <h2 id="categories-heading" className="font-display text-3xl font-bold tracking-tight">
              Çfarë mund të raportoni
            </h2>
            <p className="mt-3 text-muted-foreground">
              Çdo problem i infrastrukturës publike që prek jetën e përditshme.
            </p>
          </FadeIn>

          <ul className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-3">
            {categories.map((category, index) => (
              <FadeIn key={category.id} delay={Math.min(index * 0.04, 0.4)} asChild>
                <li>
                  <Link
                    href={`/explore?category=${category.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-medium transition-all hover:border-primary/40 hover:shadow-subtle"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                      aria-hidden
                    />
                    {category.name}
                  </Link>
                </li>
              </FadeIn>
            ))}
          </ul>
        </div>
      </section>

      {/* Popular reports */}
      {latest.items.length > 0 ? (
        <section className="border-b py-20" aria-labelledby="popular-heading">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="popular-heading" className="font-display text-3xl font-bold tracking-tight">
                  Problemet më të votuara
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Ato që qytetarët duan të zgjidhen së pari.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/explore">
                  Shiko të gjitha <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latest.items.map((report, index) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isAuthenticated={Boolean(user)}
                  priority={index === 0}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <FadeIn>
            <div className="gradient-civic relative overflow-hidden rounded-2xl px-8 py-16 text-center text-white">
              <TrendingUp
                className="absolute -right-6 -top-6 size-40 opacity-10"
                aria-hidden
              />
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Qyteti yt përmirësohet kur ti flet
              </h2>
              <p className="text-balance mx-auto mt-4 max-w-2xl text-white/85">
                Regjistrohu falas dhe bashkohu me qytetarët që po e ndryshojnë Kosovën, një raport
                në një kohë.
              </p>
              <Button size="lg" variant="secondary" asChild className="mt-8">
                <Link href={user ? "/reports/new" : "/register"}>
                  {user ? "Raporto tani" : "Krijo llogari falas"}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
