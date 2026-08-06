"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers, MapPinOff } from "lucide-react";
import type { MapMarker } from "@/types";
import { formatNumber } from "@/lib/utils";
import { ReportsMap } from "@/components/map/dynamic-map";
import { MapLegend } from "@/components/map/map-legend";
import { ReportFilters } from "@/components/reports/report-filters";
import { MarkerSummary } from "@/components/map/marker-summary";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BoundaryLegend } from "@/components/map/boundary-legend";
import { AdSlot } from "@/components/ads/ad-slot";

type Option = { id: string; name: string; slug: string; latitude?: number; longitude?: number; zoom?: number };

/**
 * Map page shell: filters drive the URL, the server re-queries markers, and
 * this component only handles view state (focus point, selected marker).
 */
export function MapExplorer({
  markers,
  municipalities,
  categories,
  boundaryStats,
}: {
  markers: MapMarker[];
  municipalities: Option[];
  categories: Option[];
  boundaryStats: Record<string, { total: number; open: number }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = React.useState<MapMarker | null>(null);
  const [showBoundaries, setShowBoundaries] = React.useState(false);

  const activeMunicipality = searchParams.get("municipality");

  /** Clicking a boundary filters the whole page to that municipality. */
  const selectMunicipality = React.useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("municipality") === slug) params.delete("municipality");
      else params.set("municipality", slug);
      params.delete("page");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Centre on the filtered municipality when one is selected.
  const focus = React.useMemo<{ center?: [number, number]; zoom?: number }>(() => {
    const slug = searchParams.get("municipality");
    if (!slug) return {};
    const match = municipalities.find((item) => item.slug === slug);
    if (!match?.latitude || !match?.longitude) return {};
    return { center: [match.latitude, match.longitude], zoom: match.zoom ?? 13 };
  }, [searchParams, municipalities]);

  return (
    <div className="space-y-4">
      <ReportFilters municipalities={municipalities} categories={categories} showSort={false} />

      <div className="flex items-center gap-2.5 rounded-xl border bg-card px-4 py-2.5">
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Label htmlFor="boundaries" className="flex-1 cursor-pointer text-sm font-normal">
          Kufijtë e komunave
          <span className="ml-2 text-xs text-muted-foreground">
            ngjyrosur sipas problemeve të hapura
          </span>
        </Label>
        <Switch id="boundaries" checked={showBoundaries} onCheckedChange={setShowBoundaries} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[60vh] overflow-hidden rounded-xl border lg:h-[72vh]">
          {markers.length === 0 ? (
            <EmptyState
              icon={MapPinOff}
              title="Asnjë raport në hartë"
              description="Nuk ka raporte që përputhen me filtrat e zgjedhur."
              className="h-full rounded-none border-0"
            />
          ) : (
            <ReportsMap
              markers={markers}
              center={focus.center}
              zoom={focus.zoom}
              onSelect={setSelected}
              showBoundaries={showBoundaries}
              boundaryStats={boundaryStats}
              highlightMunicipality={activeMunicipality}
              onMunicipalitySelect={selectMunicipality}
            />
          )}

          <MapLegend className="absolute bottom-4 right-4 z-[400] w-40" />

          {showBoundaries ? (
            <div className="absolute bottom-4 left-4 z-[400] w-44 rounded-xl border bg-background/95 p-3 shadow-elevated backdrop-blur">
              <p className="mb-2 text-xs font-semibold">Problemet e hapura</p>
              <BoundaryLegend />
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {formatNumber(markers.length)}
              </span>{" "}
              raporte të shfaqura
            </p>
            {markers.length >= 500 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Shfaqen 500 raportet më të fundit. Ngushtoni filtrat për rezultate më specifike.
              </p>
            ) : null}
          </div>

          {selected ? (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                I zgjedhur
              </h2>
              <MarkerSummary marker={selected} />
            </div>
          ) : null}

          <AdSlot id="map-sidebar" />

          <div className="min-h-0 flex-1 rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Raportet e fundit
            </h2>
            <ScrollArea className="h-[280px] lg:h-[calc(72vh-190px)]">
              <ul className="divide-y">
                {markers.slice(0, 50).map((marker) => (
                  <li key={marker.id} className="px-4 py-3 transition-colors hover:bg-accent/50">
                    <MarkerSummary marker={marker} />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </aside>
      </div>
    </div>
  );
}
