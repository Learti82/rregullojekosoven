import Image from "next/image";
import Link from "next/link";
import { ImageIcon, MapPin, MessageSquare, Eye } from "lucide-react";
import { cn, formatCompact, formatRelativeTime, initials } from "@/lib/utils";
import type { ReportListItem } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/reports/status-badge";
import { VoteButton } from "@/components/reports/vote-button";

/**
 * Feed/list card. Server component — the only client island is the vote
 * control, so a page of 12 cards ships almost no JavaScript.
 */
export function ReportCard({
  report,
  isAuthenticated,
  priority = false,
  className,
}: {
  report: ReportListItem;
  isAuthenticated: boolean;
  /** Set on above-the-fold cards so the LCP image is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}) {
  const cover = report.images[0];

  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden hover:shadow-elevated focus-within:shadow-elevated",
        className
      )}
    >
      <Link
        href={`/reports/${report.slug}`}
        className="relative block aspect-[16/10] overflow-hidden bg-muted"
        tabIndex={-1}
        aria-hidden={!!cover}
      >
        {cover ? (
          <Image
            src={cover.thumbnailUrl ?? cover.url}
            alt={cover.caption ?? report.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/40" aria-hidden />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge status={report.status} className="bg-background/95 backdrop-blur" />
        </div>

        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-white shadow-sm"
          style={{ backgroundColor: report.category.color }}
        >
          {report.category.name}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold leading-snug">
              <Link
                href={`/reports/${report.slug}`}
                className="line-clamp-2 rounded transition-colors hover:text-primary"
              >
                {report.title}
              </Link>
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {report.description}
            </p>
          </div>

          <VoteButton
            reportId={report.id}
            score={report.score}
            viewerVote={report.viewerVote ?? null}
            isAuthenticated={isAuthenticated}
            className="shrink-0"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {report.municipality.name}
            {report.address ? ` · ${report.address}` : ""}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
          <div className="flex min-w-0 items-center gap-2">
            {report.isAnonymous ? (
              <span className="truncate text-xs text-muted-foreground">Raport anonim</span>
            ) : (
              <>
                <Avatar className="size-6">
                  {report.createdBy.image ? (
                    <AvatarImage src={report.createdBy.image} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(report.createdBy.name)}
                  </AvatarFallback>
                </Avatar>
                <Link
                  href={`/profile/${report.createdBy.username}`}
                  className="truncate text-xs font-medium hover:text-primary"
                >
                  {report.createdBy.name}
                </Link>
              </>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              · <time dateTime={report.createdAt.toISOString()}>{formatRelativeTime(report.createdAt)}</time>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title="Komente">
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="tabular-nums">{formatCompact(report.commentsCount)}</span>
              <span className="sr-only">komente</span>
            </span>
            <span className="inline-flex items-center gap-1" title="Shikime">
              <Eye className="size-3.5" aria-hidden />
              <span className="tabular-nums">{formatCompact(report.viewsCount)}</span>
              <span className="sr-only">shikime</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ReportCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="skeleton aspect-[16/10]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="flex items-center gap-2 border-t pt-3">
          <div className="skeleton size-6 rounded-full" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
    </Card>
  );
}
