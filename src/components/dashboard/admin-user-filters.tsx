"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { ROLE_LABELS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function AdminUserFilters({
  municipalities,
}: {
  municipalities: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const debounced = useDebounce(query, 350);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
      params.delete("page");
      router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    if (debounced === (searchParams.get("q") ?? "")) return;
    setParam("q", debounced || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_180px_200px]">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kërko sipas emrit ose email-it…"
          className="pl-9"
          aria-label="Kërko përdorues"
        />
      </div>

      <Select
        value={searchParams.get("role") ?? ALL}
        onValueChange={(value) => setParam("role", value)}
      >
        <SelectTrigger aria-label="Filtro sipas rolit">
          <SelectValue placeholder="Roli" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Të gjithë rolet</SelectItem>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("municipality") ?? ALL}
        onValueChange={(value) => setParam("municipality", value)}
      >
        <SelectTrigger aria-label="Filtro sipas komunës">
          <SelectValue placeholder="Komuna" />
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
  );
}
