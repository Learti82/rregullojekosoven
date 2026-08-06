"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Leaflet touches `window` at import time, so every map is loaded client-side
 * only. Keeping the `dynamic()` calls in one place means pages can import a map
 * like any other component.
 */

const MapFallback = ({ className }: { className?: string }) => (
  <div className={className}>
    <Skeleton className="size-full min-h-[300px] rounded-xl" />
  </div>
);

export const ReportsMap = dynamic(
  () => import("@/components/map/reports-map").then((mod) => mod.ReportsMap),
  { ssr: false, loading: () => <MapFallback className="size-full" /> }
);

export const SingleReportMap = dynamic(
  () => import("@/components/map/reports-map").then((mod) => mod.SingleReportMap),
  { ssr: false, loading: () => <MapFallback className="size-full" /> }
);

export const LocationPicker = dynamic(
  () => import("@/components/map/location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-xl" />,
  }
);
