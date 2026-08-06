"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { ReportStatus } from "@prisma/client";
import { REPORT_STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Colour key for the map. Collapsible so it never eats mobile screen space. */
export function MapLegend({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border bg-background/95 p-3 shadow-elevated backdrop-blur",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold"
      >
        Legjenda
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <ul className="mt-2 space-y-1.5">
          {(Object.keys(REPORT_STATUS_META) as ReportStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-2 text-xs">
              <span
                className="size-3 shrink-0 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: REPORT_STATUS_META[status].color }}
                aria-hidden
              />
              {REPORT_STATUS_META[status].label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
