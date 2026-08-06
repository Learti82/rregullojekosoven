import { cn } from "@/lib/utils";

/**
 * Colour key for the boundary choropleth.
 *
 * Kept out of `municipality-boundaries.tsx` on purpose: that module imports
 * Leaflet at the top level, so anything a server-rendered tree imports directly
 * would drag Leaflet into the page bundle and defeat the `ssr: false` wrapper.
 */
/** Colour key for the choropleth, shown next to the map legend. */
export function BoundaryLegend({ className }: { className?: string }) {
  const bands = [
    { label: "Pak probleme", color: "#2563eb", opacity: 0.14 },
    { label: "Mesatare", color: "#f59e0b", opacity: 0.3 },
    { label: "Shumë", color: "#ea580c", opacity: 0.36 },
    { label: "Kritike", color: "#b91c1c", opacity: 0.42 },
  ];

  return (
    <ul className={cn("space-y-1.5", className)}>
      {bands.map((band) => (
        <li key={band.label} className="flex items-center gap-2 text-xs">
          <span
            className="size-3 shrink-0 rounded-sm border border-slate-400/50"
            style={{ backgroundColor: band.color, opacity: band.opacity + 0.3 }}
            aria-hidden
          />
          {band.label}
        </li>
      ))}
      <li className="pt-1 text-[10px] leading-tight text-muted-foreground">
        Kufijtë: geoBoundaries / OpenStreetMap
      </li>
    </ul>
  );
}
