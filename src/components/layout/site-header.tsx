import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";
import { getUnreadCount } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";

/**
 * Server-rendered app header. Session and unread count are resolved here so the
 * first paint is already correct — no client-side auth flash.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadCount(user.id) : 0;

  return (
    <header className="glass sticky top-0 z-40 w-full border-b">
      <div className="container flex h-16 items-center gap-3">
        <MobileNav user={user} />

        <Link href="/" className="mr-1 shrink-0 rounded-md" aria-label="RregulloKosovën — ballina">
          <Logo textClassName="hidden sm:inline" />
        </Link>

        <MainNav className="hidden md:flex" role={user?.role ?? null} />

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" asChild aria-label="Kërko raporte">
            <Link href="/explore">
              <Search className="size-[18px]" />
            </Link>
          </Button>

          <ThemeToggle />

          {user ? (
            <>
              <NotificationBell initialCount={unreadCount} />
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/reports/new">
                  <Plus className="size-4" />
                  Raporto
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">Kyçu</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Regjistrohu</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
