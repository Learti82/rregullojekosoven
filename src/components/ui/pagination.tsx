"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  className?: string;
};

/**
 * Link-based pagination: every page is a real URL, so results are shareable,
 * crawlable and survive a refresh.
 */
export function Pagination({ page, totalPages, className }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  // Window of pages around the current one, with ellipses at the edges.
  const windowSize = 2;
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= windowSize) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="Faqosja">
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          page <= 1 && "pointer-events-none opacity-50"
        )}
        aria-label="Faqja e mëparshme"
      >
        <ChevronLeft className="size-4" />
      </Link>

      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: item === page ? "default" : "ghost", size: "icon-sm" }),
              "tabular-nums"
            )}
          >
            {item}
          </Link>
        )
      )}

      <Link
        href={hrefFor(page + 1)}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          page >= totalPages && "pointer-events-none opacity-50"
        )}
        aria-label="Faqja tjetër"
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
