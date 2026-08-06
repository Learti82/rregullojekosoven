import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Eye, HeartHandshake, Scale } from "lucide-react";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { getPlatformCounters } from "@/server/queries/stats";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Rreth nesh",
  description: APP_DESCRIPTION,
  alternates: { canonical: "/about" },
};

export const revalidate = 86400;

const VALUES = [
  {
    icon: Eye,
    title: "Transparencë",
    body: "Çdo raport, çdo ndryshim statusi dhe çdo shënim publik janë të dukshëm për këdo. Historiku i një problemi nuk mund të fshihet.",
  },
  {
    icon: HeartHandshake,
    title: "Bashkëpunim, jo konflikt",
    body: "Platforma nuk është kundër komunave — është një kanal i drejtpërdrejtë mes tyre dhe banorëve, që kursen kohë për të dyja palët.",
  },
  {
    icon: Scale,
    title: "Barazi",
    body: "Një problem në një fshat ka të njëjtën peshë si një problem në qendër të Prishtinës. Votat e qytetarëve përcaktojnë prioritetin.",
  },
  {
    icon: Building2,
    title: "Përgjegjshmëri",
    body: "Koha mesatare e zgjidhjes matet publikisht për çdo komunë. Ajo që matet, përmirësohet.",
  },
] as const;

export default async function AboutPage() {
  const counters = await getPlatformCounters();

  return (
    <div className="container max-w-3xl">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight">Rreth {APP_NAME}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Një platformë qytetare që e bën raportimin e problemeve publike aq të thjeshtë sa dërgimi
          i një mesazhi — dhe aq transparent sa një regjistër publik.
        </p>
      </header>

      <section className="prose-neutral mb-12 space-y-4 text-[15px] leading-relaxed">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Problemi</h2>
        <p>
          Një gropë në rrugë mund të qëndrojë me muaj sepse askush nuk e di se kujt t&apos;i
          drejtohet. Telefonatat humbin, ankesat në letër zhduken, dhe qytetari nuk mëson kurrë nëse
          dikush e mori seriozisht.
        </p>
        <p>
          Nga ana tjetër, komunat shpesh nuk kanë një pasqyrë të plotë të asaj që po ndodh në
          terren. Informacioni ekziston — te banorët — por nuk ka rrugë për të arritur te vendimmarrja.
        </p>

        <h2 className="font-display text-2xl font-semibold tracking-tight">Zgjidhja</h2>
        <p>
          {APP_NAME} e kthen çdo qytetar me telefon në një sensor për qytetin e tij. Një foto, një
          përshkrim i shkurtër dhe një pikë në hartë krijojnë një regjistrim publik me numër
          reference, që komuna e sheh menjëherë dhe që askush nuk mund ta injorojë në heshtje.
        </p>
        <p>
          Votat e qytetarëve rendisin problemet sipas asaj që ndikon më shumë njerëz. Statuset —
          nga <em>Në pritje</em> te <em>I zgjidhur</em> — dokumentohen me foto të punës së kryer.
        </p>
      </section>

      <section aria-labelledby="values-heading" className="mb-12">
        <h2 id="values-heading" className="mb-6 font-display text-2xl font-semibold tracking-tight">
          Parimet tona
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((value) => (
            <li key={value.title}>
              <Card className="h-full p-5">
                <value.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-display text-base font-semibold">{value.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{value.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="numbers-heading" className="mb-12">
        <h2 id="numbers-heading" className="mb-6 font-display text-2xl font-semibold tracking-tight">
          Platforma sot
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Raporte", value: counters.reports },
            { label: "Të zgjidhura", value: counters.resolved },
            { label: "Qytetarë", value: counters.users },
            { label: "Komuna", value: counters.municipalities },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 text-center">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {formatNumber(stat.value)}
              </dd>
            </Card>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border bg-muted/40 p-6">
        <h2 className="font-display text-xl font-semibold">Jeni komunë?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Nëse punoni në një komunë të Kosovës dhe dëshironi qasje në panelin e menaxhimit për
          territorin tuaj, kontaktoni administratorin e platformës për të aktivizuar llogaritë e
          stafit.
        </p>
        <Button asChild className="mt-4">
          <Link href="/register">Fillo këtu</Link>
        </Button>
      </section>
    </div>
  );
}
