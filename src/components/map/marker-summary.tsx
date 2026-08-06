import Link from "next/link";
import { REPORT_STATUS_META } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import type { MapMarker } from "@/types";

/**
 * Compact marker description for the map page's side panel.
 *
 * Kept in its own module, free of any Leaflet import: `reports-map.tsx` touches
 * `window` at import time (Leaflet and its cluster plugin do), so anything that
 * a server-rendered tree imports statically must not live there — otherwise the
 * `ssr: false` wrapper in `dynamic-map.tsx` is bypassed and the page crashes.
 */
export function MarkerSummary({ marker }: { marker: MapMarker }) {
  const meta = REPORT_STATUS_META[marker.status];
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </span>
      <Link href={`/reports/${marker.slug}`} className="block font-medium hover:text-primary">
        {marker.title}
      </Link>
      <p className="text-xs text-muted-foreground">
        {marker.categoryName} · {marker.municipalityName} · {formatRelativeTime(marker.createdAt)}
      </p>
    </div>
  );
}
