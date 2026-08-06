import type { ReportPriority, ReportStatus } from "@prisma/client";

export const APP_NAME = "RregulloKosovën";
export const APP_TAGLINE = "Raporto problemin. Ndrysho qytetin.";
export const APP_DESCRIPTION =
  "Platforma qytetare e Kosovës për raportimin e problemeve publike — rrugë të dëmtuara, mbeturina, ndriçim publik dhe më shumë. Raporto, voto dhe ndiqe zgjidhjen nga komuna jote.";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** Geographic centre of Kosovo — the default map view. */
export const KOSOVO_CENTER = { lat: 42.6026, lng: 20.903 } as const;
export const KOSOVO_DEFAULT_ZOOM = 9;

/** Bounding box used to reject coordinates that fall outside the country. */
export const KOSOVO_BOUNDS = {
  minLat: 41.85,
  maxLat: 43.28,
  minLng: 20.0,
  maxLng: 21.8,
} as const;

export const PAGE_SIZE = 12;
export const MAP_PAGE_SIZE = 500;
export const COMMENTS_PAGE_SIZE = 20;
export const NOTIFICATIONS_PAGE_SIZE = 20;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMAGES_PER_REPORT = 6;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type StatusMeta = {
  label: string;
  description: string;
  /** Tailwind classes for badges. */
  className: string;
  /** Hex used by map markers and charts. */
  color: string;
  /** Statuses considered "resolved" for analytics. */
  terminal: boolean;
};

export const REPORT_STATUS_META: Record<ReportStatus, StatusMeta> = {
  PENDING: {
    label: "Në pritje",
    description: "Raporti është dërguar dhe pret verifikim nga komuna.",
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    color: "#64748b",
    terminal: false,
  },
  VERIFIED: {
    label: "I verifikuar",
    description: "Komuna e ka konfirmuar problemin.",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    color: "#2563eb",
    terminal: false,
  },
  ASSIGNED: {
    label: "I caktuar",
    description: "Problemi i është caktuar një ekipi punues.",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
    color: "#7c3aed",
    terminal: false,
  },
  IN_PROGRESS: {
    label: "Në proces",
    description: "Punimet për zgjidhjen e problemit kanë filluar.",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    color: "#d97706",
    terminal: false,
  },
  COMPLETED: {
    label: "I zgjidhur",
    description: "Problemi është zgjidhur dhe dokumentuar.",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    color: "#059669",
    terminal: true,
  },
  REJECTED: {
    label: "I refuzuar",
    description: "Raporti nuk u pranua. Arsyeja është e shënuar nga komuna.",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
    color: "#e11d48",
    terminal: true,
  },
  DUPLICATE: {
    label: "Dublikat",
    description: "Ky problem është raportuar më parë.",
    className:
      "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    color: "#a1a1aa",
    terminal: true,
  },
};

export const REPORT_PRIORITY_META: Record<
  ReportPriority,
  { label: string; className: string; color: string; weight: number }
> = {
  LOW: {
    label: "E ulët",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    color: "#94a3b8",
    weight: 1,
  },
  MEDIUM: {
    label: "Mesatare",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    color: "#3b82f6",
    weight: 2,
  },
  HIGH: {
    label: "E lartë",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    color: "#f59e0b",
    weight: 3,
  },
  CRITICAL: {
    label: "Kritike",
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    color: "#ef4444",
    weight: 4,
  },
};

/**
 * Allowed status transitions. Enforced server-side in `updateReportStatus`
 * so the workflow cannot be skipped by a crafted request.
 */
export const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  PENDING: ["VERIFIED", "REJECTED", "DUPLICATE"],
  VERIFIED: ["ASSIGNED", "IN_PROGRESS", "REJECTED", "DUPLICATE"],
  ASSIGNED: ["IN_PROGRESS", "VERIFIED", "REJECTED"],
  IN_PROGRESS: ["COMPLETED", "ASSIGNED", "REJECTED"],
  COMPLETED: ["IN_PROGRESS"],
  REJECTED: ["PENDING", "VERIFIED"],
  DUPLICATE: ["PENDING"],
};

export const SORT_OPTIONS = [
  { value: "recent", label: "Më të rejat" },
  { value: "popular", label: "Më të votuarat" },
  { value: "discussed", label: "Më të diskutuarat" },
  { value: "oldest", label: "Më të vjetrat" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const DATE_RANGE_OPTIONS = [
  { value: "all", label: "Të gjitha" },
  { value: "24h", label: "24 orët e fundit" },
  { value: "7d", label: "7 ditët e fundit" },
  { value: "30d", label: "30 ditët e fundit" },
  { value: "year", label: "Këtë vit" },
] as const;

export type DateRangeOption = (typeof DATE_RANGE_OPTIONS)[number]["value"];

export const ROLE_LABELS: Record<string, string> = {
  CITIZEN: "Qytetar",
  MUNICIPALITY_EMPLOYEE: "Punonjës komunal",
  MUNICIPALITY_ADMIN: "Administrator komunal",
  ADMIN: "Administrator",
};
