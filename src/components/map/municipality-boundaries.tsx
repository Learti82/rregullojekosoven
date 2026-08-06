"use client";

import * as React from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

/**
 * Administrative boundaries of Kosovo's 38 municipalities.
 *
 * Source: geoBoundaries (XKX, ADM2, derived from OpenStreetMap), simplified for
 * the web by `scripts/build-boundaries.mjs`.
 *
 * The file is ~0.6MB, so it is fetched lazily — only when the layer is actually
 * switched on — and then cached in a module-level promise so toggling it off and
 * on again, or moving between pages, never refetches. It is deliberately not
 * imported: a static import would bundle it into the page's JavaScript.
 */

export type BoundaryFeature = {
  type: "Feature";
  properties: { name: string; slug: string; sourceName: string };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

type BoundaryCollection = { type: "FeatureCollection"; features: BoundaryFeature[] };

let cache: Promise<BoundaryCollection> | null = null;

export function loadBoundaries(): Promise<BoundaryCollection> {
  cache ??= fetch("/data/kosovo-municipalities.geojson")
    .then((response) => {
      if (!response.ok) throw new Error(`Boundaries unavailable (${response.status})`);
      return response.json() as Promise<BoundaryCollection>;
    })
    .catch((error) => {
      // Let a later attempt retry rather than caching the failure forever.
      cache = null;
      throw error;
    });
  return cache;
}

/**
 * Per-municipality report counts drive an optional choropleth: the more open
 * problems a municipality has, the stronger its fill.
 */
export type BoundaryStats = Record<string, { total: number; open: number }>;

function fillFor(count: number, max: number): { color: string; opacity: number } {
  if (max <= 0 || count <= 0) return { color: "#94a3b8", opacity: 0.06 };
  const ratio = count / max;
  // Five bands read more clearly on a map than a continuous ramp.
  if (ratio > 0.75) return { color: "#b91c1c", opacity: 0.42 };
  if (ratio > 0.5) return { color: "#ea580c", opacity: 0.36 };
  if (ratio > 0.25) return { color: "#f59e0b", opacity: 0.3 };
  if (ratio > 0.1) return { color: "#2563eb", opacity: 0.24 };
  return { color: "#2563eb", opacity: 0.14 };
}

export function MunicipalityBoundaries({
  visible,
  stats,
  highlightSlug,
  onSelect,
}: {
  visible: boolean;
  /** When provided, boundaries are shaded by open-report volume. */
  stats?: BoundaryStats;
  highlightSlug?: string | null;
  onSelect?: (slug: string, name: string) => void;
}) {
  const map = useMap();
  const layerRef = React.useRef<L.GeoJSON | null>(null);
  const [data, setData] = React.useState<BoundaryCollection | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch once, the first time the layer is switched on.
  React.useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    loadBoundaries()
      .then((collection) => !cancelled && setData(collection))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [visible, data]);

  const maxOpen = React.useMemo(() => {
    if (!stats) return 0;
    return Object.values(stats).reduce((max, entry) => Math.max(max, entry.open), 0);
  }, [stats]);

  /**
   * Latest style inputs and callback, held in refs.
   *
   * Putting these in the effect's dependency list rebuilt all 38 polygons on
   * every parent render — `stats` arrives as a fresh object each time — and a
   * click landing during a rebuild was silently dropped, because the layer
   * carrying the handler had already been removed. Refs keep the layer stable
   * and always let it read current values.
   */
  const styleRef = React.useRef({ stats, maxOpen, highlightSlug });
  const onSelectRef = React.useRef(onSelect);
  styleRef.current = { stats, maxOpen, highlightSlug };
  onSelectRef.current = onSelect;

  const styleFor = React.useCallback((slug: string): L.PathOptions => {
    const { stats: s, maxOpen: max, highlightSlug: highlight } = styleRef.current;
    const fill = fillFor(s?.[slug]?.open ?? 0, max);
    const isHighlighted = highlight === slug;
    return {
      color: isHighlighted ? "#1E4FD8" : "#64748b",
      weight: isHighlighted ? 3 : 1,
      opacity: isHighlighted ? 0.95 : 0.55,
      fillColor: fill.color,
      fillOpacity: isHighlighted ? Math.min(0.5, fill.opacity + 0.12) : fill.opacity,
      interactive: true,
    };
  }, []);

  // Build the layer once per dataset, never on a style change.
  React.useEffect(() => {
    if (!data) return;

    const layer = L.geoJSON(data as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) =>
        styleFor((feature?.properties as BoundaryFeature["properties"])?.slug ?? ""),
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties as BoundaryFeature["properties"];

        featureLayer.on({
          mouseover: (event) => {
            (event.target as L.Path).setStyle({ weight: 2.5, opacity: 0.9 });
          },
          mouseout: (event) => {
            (event.target as L.Path).setStyle(styleFor(props.slug));
          },
          click: () => onSelectRef.current?.(props.slug, props.name),
        });
      },
    });

    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [data, styleFor]);

  // Attach/detach without rebuilding.
  React.useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
      // Keep outlines under the markers so pins stay clickable.
      layer.bringToBack();
    } else {
      layer.remove();
    }
  }, [visible, map, data]);

  /**
   * Restyle and update tooltip text in place.
   *
   * Keyed on the serialised stats rather than the object, because `stats` is a
   * fresh object on every parent render: depending on its identity re-ran this
   * on every render, and unbinding/rebinding tooltips across all 38 layers
   * mid-interaction intermittently swallowed clicks. Tooltip text is updated
   * with `setTooltipContent`, which leaves the binding — and its event
   * handlers — untouched.
   */
  const statsKey = React.useMemo(() => JSON.stringify(stats ?? {}), [stats]);

  React.useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.eachLayer((child) => {
      const props = (child as L.Layer & { feature?: { properties: BoundaryFeature["properties"] } })
        .feature?.properties;
      if (!props) return;

      (child as L.Path).setStyle(styleFor(props.slug));

      const entry = styleRef.current.stats?.[props.slug];
      const content = entry
        ? `<strong>${escapeHtml(props.name)}</strong><br/>${entry.open} të hapura · ${entry.total} gjithsej`
        : `<strong>${escapeHtml(props.name)}</strong>`;

      if (child.getTooltip()) child.setTooltipContent(content);
      else child.bindTooltip(content, { sticky: true, direction: "top", opacity: 0.95 });
    });
  }, [statsKey, highlightSlug, styleFor, data]);

  // Surface a fetch failure once, without breaking the rest of the map.
  React.useEffect(() => {
    if (error) console.warn("[boundaries]", error);
  }, [error]);

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
