"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Unread badge. The count is server-rendered on each navigation, which is
 * accurate enough without holding a socket open for every visitor.
 */
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const count = initialCount;
  const label =
    count > 0 ? `Njoftimet (${count} të palexuara)` : "Njoftimet";

  return (
    <Button variant="ghost" size="icon" asChild aria-label={label} className="relative">
      <Link href="/notifications">
        <Bell className="size-[18px]" />
        {count > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-[18px] text-destructive-foreground"
            aria-hidden
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
