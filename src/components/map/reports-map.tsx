"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { KOSOVO_CENTER, KOSOVO_DEFAULT_ZOOM, REPORT_STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MapMarker } from "@/types";

/**
 * Clustered report map.
 *
 * Markers are drawn onto a `MarkerClusterGroup` imperatively rather than as
 * React children: at national scale a page can hold hundreds of pins, and
 * reconciling that many components on every pan is far more expensive than
 * letting Leaflet own the layer.
 */

/** Coloured pin whose fill encodes the report's status. */
function buildIcon(status: MapMarker["status"], categoryColor: string) {
  const statusColor = REPORT_STATUS_META[status].color;
  return L.divIcon({
    className: "!bg-transparent !border-0",
    html: `
      <span class="rk-marker" style="width:28px;height:28px;background:${statusColor}">
        <span style="width:10px;height:10px;border-radius:9999px;background:${categoryColor};display:block"></span>
      </span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function ClusterLayer({
  markers,
  onSelect,
}: {
  markers: MapMarker[];
  onSelect?: (marker: MapMarker) => void;
}) {
  const map = useMap();
  const groupRef = React.useRef<L.MarkerClusterGroup | null>(null);

  React.useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 34 : count < 100 ? 42 : 52;
        return L.divIcon({
          html: `<span class="rk-cluster" style="width:${size}px;height:${size}px">${count}</span>`,
          className: "!bg-transparent !border-0",
          iconSize: L.point(size, size),
        });
      },
    });

    groupRef.current = group;
    map.addLayer(group);

    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  React.useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.clearLayers();

    const layers = markers.map((marker) => {
      const leafletMarker = L.marker([marker.latitude, marker.longitude], {
        icon: buildIcon(marker.status, marker.categoryColor),
        title: marker.title,
        alt: marker.title,
      });

      // Popups are built as HTML strings; every interpolated value is escaped
      // by `escapeHtml` below, since this bypasses React's escaping.
      leafletMarker.bindPopup(popupHtml(marker), { closeButton: true, minWidth: 240 });
      if (onSelect) leafletMarker.on("click", () => onSelect(marker));
      return leafletMarker;
    });

    group.addLayers(layers);
  }, [markers, onSelect]);

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

function popupHtml(marker: MapMarker): string {
  const meta = REPORT_STATUS_META[marker.status];
  const image = marker.thumbnailUrl
    ? `<img src="${escapeHtml(marker.thumbnailUrl)}" alt="" style="width:100%;height:120px;object-fit:cover;display:block" loading="lazy" />`
    : "";
  return `
    <div style="font-family:inherit">
      ${image}
      <div style="padding:12px">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:${meta.color}">
          <span style="width:6px;height:6px;border-radius:9999px;background:${meta.color}"></span>
          ${escapeHtml(meta.label)}
        </span>
        <h3 style="margin:6px 0 4px;font-size:14px;font-weight:600;line-height:1.35">${escapeHtml(marker.title)}</h3>
        <p style="margin:0 0 10px;font-size:12px;opacity:.7">
          ${escapeHtml(marker.categoryName)} · ${escapeHtml(marker.municipalityName)}
        </p>
        <a href="/reports/${encodeURIComponent(marker.slug)}"
           style="display:inline-block;font-size:12px;font-weight:600;color:#2563eb;text-decoration:none">
          Shiko raportin →
        </a>
      </div>
    </div>`;
}

/** Re-centres the map when the caller changes the focus point. */
function MapFocus({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
}

export function ReportsMap({
  markers,
  center,
  zoom,
  className,
  onSelect,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  onSelect?: (marker: MapMarker) => void;
}) {
  return (
    <MapContainer
      center={center ?? [KOSOVO_CENTER.lat, KOSOVO_CENTER.lng]}
      zoom={zoom ?? KOSOVO_DEFAULT_ZOOM}
      scrollWheelZoom
      className={cn("size-full", className)}
      // Keep panning inside the region so users cannot get lost at sea.
      maxBounds={[
        [41.6, 19.6],
        [43.5, 22.2],
      ]}
      minZoom={8}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapFocus center={center} zoom={zoom} />
      <ClusterLayer markers={markers} onSelect={onSelect} />
    </MapContainer>
  );
}

/** Single read-only pin, used on the report detail page. */
export function SingleReportMap({
  latitude,
  longitude,
  title,
  status,
  color,
  className,
}: {
  latitude: number;
  longitude: number;
  title: string;
  status: MapMarker["status"];
  color: string;
  className?: string;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom={false}
      className={cn("size-full", className)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Marker position={[latitude, longitude]} icon={buildIcon(status, color)}>
        <Popup>{title}</Popup>
      </Marker>
    </MapContainer>
  );
}
