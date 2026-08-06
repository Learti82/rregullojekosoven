import type { Metadata } from "next";
import { Suspense } from "react";
import { getMapMarkers } from "@/server/queries/reports";
import { getCategories, getMunicipalities } from "@/server/queries/taxonomy";
import { reportFiltersSchema } from "@/validations/report";
import { Skeleton } from "@/components/ui/skeleton";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = {
  title: "Harta e problemeve",
  description:
    "Shikoni në hartë të gjitha problemet publike të raportuara në Kosovë, të grupuara sipas zonës dhe statusit.",
  alternates: { canonical: "/map" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function MapData({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const parsed = reportFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const [markers, municipalities, categories] = await Promise.all([
    getMapMarkers(filters),
    getMunicipalities(),
    getCategories(),
  ]);

  return (
    <MapExplorer markers={markers} municipalities={municipalities} categories={categories} />
  );
}

export default function MapPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="container max-w-7xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Harta e problemeve</h1>
        <p className="mt-1.5 text-muted-foreground">
          Çdo pin është një problem i raportuar. Ngjyra tregon statusin e tij.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-[70vh] w-full rounded-xl" />}>
        <MapData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
