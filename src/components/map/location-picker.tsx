"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";
import { KOSOVO_CENTER, KOSOVO_DEFAULT_ZOOM } from "@/lib/constants";
import { cn, isInsideKosovo } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";

export type PickedLocation = { lat: number; lng: number };

const pinIcon = L.divIcon({
  className: "!bg-transparent !border-0",
  html: `<span class="rk-marker" style="width:30px;height:30px;background:#1E4FD8">
           <span style="width:10px;height:10px;border-radius:9999px;background:#fff;display:block"></span>
         </span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function ClickHandler({ onPick }: { onPick: (location: PickedLocation) => void }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      if (isInsideKosovo(lat, lng)) onPick({ lat, lng });
    },
  });
  return null;
}

function Recenter({ location }: { location: PickedLocation | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (location) map.setView([location.lat, location.lng], Math.max(map.getZoom(), 16));
  }, [location, map]);
  return null;
}

/**
 * Map-based location picker for the report composer.
 *
 * Tap anywhere to drop a pin, drag it to refine, or use "my location" for GPS.
 * Coordinates outside the Kosovo bounding box are rejected here and again by
 * the Zod schema server-side.
 */
export function LocationPicker({
  value,
  onChange,
  className,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
  className?: string;
}) {
  const geo = useGeolocation();

  React.useEffect(() => {
    if (geo.coords) onChange(geo.coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.coords]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative h-[320px] overflow-hidden rounded-xl border">
        <MapContainer
          center={value ? [value.lat, value.lng] : [KOSOVO_CENTER.lat, KOSOVO_CENTER.lng]}
          zoom={value ? 16 : KOSOVO_DEFAULT_ZOOM}
          scrollWheelZoom
          className="size-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <ClickHandler onPick={onChange} />
          <Recenter location={value} />
          {value ? (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = (event.target as L.Marker).getLatLng();
                  if (isInsideKosovo(lat, lng)) onChange({ lat, lng });
                },
              }}
            />
          ) : null}
        </MapContainer>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[400] flex justify-center p-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={geo.request}
            loading={geo.loading}
            className="pointer-events-auto shadow-elevated"
          >
            <Crosshair /> Përdor vendndodhjen time
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {value ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <MapPin className="size-3.5" aria-hidden />
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Klikoni në hartë për të shënuar vendndodhjen e problemit.
          </span>
        )}
        {geo.error ? (
          <span className="text-destructive" role="alert">
            {geo.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
