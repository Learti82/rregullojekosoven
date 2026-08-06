"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  DATE_RANGE_OPTIONS,
  REPORT_STATUS_META,
  SORT_OPTIONS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@prisma/client";

type Option = { id: string; name: string; slug: string };

const ALL = "__all__";

/**
 * URL-driven filters.
 *
 * Filter state lives entirely in the query string, so every result set is
 * bookmarkable and the server component re-renders from the URL alone. The
 * search box is debounced and replaces history entries rather than pushing, so
 * typing does not flood the back button.
 */
export function ReportFilters({
  municipalities,
  categories,
  showStatus = true,
  showSort = true,
}: {
  municipalities: Option[];
  categories: Option[];
  showStatus?: boolean;
  showSort?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const debouncedQuery = useDebounce(query, 350);
  const [expanded, setExpanded] = React.useState(false);

  const setParam = React.useCallback(
    (key: string, value: string | null, options?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
      // Any filter change invalidates the current page offset.
      params.delete("page");
      const url = params.toString() ? `${pathname}?${params}` : pathname;
      if (options?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Push the debounced term without stacking history entries.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (debouncedQuery === current) return;
    setParam("q", debouncedQuery || null, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const activeFilters = ["municipality", "category", "status", "range", "priority"].filter(
    (key) => searchParams.get(key) && searchParams.get(key) !== "all"
  );

  const clearAll = () => {
    setQuery("");
    router.push(pathname, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kërko sipas titullit, përshkrimit, komunës…"
            className="pl-9"
            aria-label="Kërko raporte"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="sm:w-auto"
        >
          <Filter />
          Filtrat
          {activeFilters.length > 0 ? (
            <Badge variant="default" className="ml-1 px-1.5">
              {activeFilters.length}
            </Badge>
          ) : null}
        </Button>
      </div>

      {expanded ? (
        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-municipality">Komuna</Label>
            <Select
              value={searchParams.get("municipality") ?? ALL}
              onValueChange={(value) => setParam("municipality", value)}
            >
              <SelectTrigger id="filter-municipality">
                <SelectValue placeholder="Të gjitha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Të gjitha komunat</SelectItem>
                {municipalities.map((item) => (
                  <SelectItem key={item.id} value={item.slug}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-category">Kategoria</Label>
            <Select
              value={searchParams.get("category") ?? ALL}
              onValueChange={(value) => setParam("category", value)}
            >
              <SelectTrigger id="filter-category">
                <SelectValue placeholder="Të gjitha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Të gjitha kategoritë</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item.id} value={item.slug}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showStatus ? (
            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Statusi</Label>
              <Select
                value={searchParams.get("status") ?? ALL}
                onValueChange={(value) => setParam("status", value)}
              >
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="Të gjitha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Të gjitha statuset</SelectItem>
                  {(Object.keys(REPORT_STATUS_META) as ReportStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {REPORT_STATUS_META[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="filter-range">Periudha</Label>
            <Select
              value={searchParams.get("range") ?? "all"}
              onValueChange={(value) => setParam("range", value === "all" ? null : value)}
            >
              <SelectTrigger id="filter-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showSort ? (
            <div className="space-y-1.5">
              <Label htmlFor="filter-sort">Rendit sipas</Label>
              <Select
                value={searchParams.get("sort") ?? "recent"}
                onValueChange={(value) => setParam("sort", value === "recent" ? null : value)}
              >
                <SelectTrigger id="filter-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {activeFilters.length > 0 || query ? (
            <div className="flex items-end">
              <Button variant="ghost" onClick={clearAll} className="w-full">
                <X /> Pastro filtrat
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
