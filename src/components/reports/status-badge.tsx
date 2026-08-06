import type { ReportPriority, ReportStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { REPORT_PRIORITY_META, REPORT_STATUS_META } from "@/lib/constants";

export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: ReportStatus;
  className?: string;
  showDot?: boolean;
}) {
  const meta = REPORT_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        meta.className,
        className
      )}
      title={meta.description}
    >
      {showDot ? (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden
        />
      ) : null}
      {meta.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: ReportPriority;
  className?: string;
}) {
  const meta = REPORT_PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.className,
        className
      )}
    >
      Prioritet: {meta.label}
    </span>
  );
}
