import { CircleDot } from "lucide-react";
import type { StatusHistory } from "@prisma/client";
import { REPORT_STATUS_META } from "@/lib/constants";
import { formatDateTime, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Entry = StatusHistory & {
  changedBy: { id: string; name: string; username: string; image: string | null };
};

/** Public audit trail of every status change on a report. */
export function StatusTimeline({
  history,
  createdAt,
}: {
  history: Entry[];
  createdAt: Date;
}) {
  return (
    <section aria-labelledby="timeline-heading" className="space-y-4">
      <h2 id="timeline-heading" className="font-display text-lg font-semibold">
        Historiku i raportit
      </h2>

      <ol className="relative space-y-6 border-l pl-6">
        {history.map((entry) => {
          const meta = REPORT_STATUS_META[entry.toStatus];
          return (
            <li key={entry.id} className="relative">
              <span
                className="absolute -left-[31px] flex size-4 items-center justify-center rounded-full border-2 border-background"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                {entry.fromStatus ? (
                  <span className="text-xs text-muted-foreground">
                    nga {REPORT_STATUS_META[entry.fromStatus].label}
                  </span>
                ) : null}
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  · {formatDateTime(entry.createdAt)}
                </time>
              </div>

              {entry.note ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.note}</p>
              ) : null}

              <div className="mt-2 flex items-center gap-2">
                <Avatar className="size-5">
                  {entry.changedBy.image ? <AvatarImage src={entry.changedBy.image} alt="" /> : null}
                  <AvatarFallback className="text-[9px]">
                    {initials(entry.changedBy.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{entry.changedBy.name}</span>
              </div>
            </li>
          );
        })}

        {history.length === 0 ? (
          <li className="relative">
            <CircleDot className="absolute -left-[31px] size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Raporti u krijua më {formatDateTime(createdAt)}.
            </p>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
