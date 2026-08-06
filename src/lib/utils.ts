import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict, format } from "date-fns";
import { sq } from "date-fns/locale";
import { KOSOVO_BOUNDS } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * URL-safe slug that keeps Albanian characters readable
 * (ë → e, ç → c) instead of dropping them.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Slug plus a short random suffix, so titles can repeat without colliding. */
export function uniqueSlug(input: string): string {
  const base = slugify(input) || "raport";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export function formatRelativeTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(value, { addSuffix: true, locale: sq });
}

export function formatDate(date: Date | string, pattern = "d MMMM yyyy"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return format(value, pattern, { locale: sq });
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, "d MMM yyyy, HH:mm");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("sq").format(value);
}

/** 1200 → "1.2k" for compact counters. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("sq", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Human-friendly duration in hours, used by the resolution-time analytics. */
export function formatDuration(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} orë`;
  return `${Math.round(hours / 24)} ditë`;
}

export function isInsideKosovo(lat: number, lng: number): boolean {
  return (
    lat >= KOSOVO_BOUNDS.minLat &&
    lat <= KOSOVO_BOUNDS.maxLat &&
    lng >= KOSOVO_BOUNDS.minLng &&
    lng <= KOSOVO_BOUNDS.maxLng
  );
}

/** Great-circle distance in kilometres — used for duplicate detection. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Escape HTML-significant characters.
 *
 * All user text is rendered as React children (which escapes automatically);
 * this helper exists for the few places that build strings for non-React sinks,
 * such as JSON-LD and OG image text.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute URL builder for metadata, OG tags and sitemaps. */
export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Only allow relative, single-slash paths as post-login redirects, so a crafted
 * `?callbackUrl=https://evil.example` cannot bounce a user off-site.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/feed"): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Deterministic pseudo-random pick, used for stable avatar accent colours. */
export function hashToIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}
