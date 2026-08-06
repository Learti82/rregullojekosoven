"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Compass, Home, Map, Menu, Plus, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import type { SessionUser } from "@/lib/permissions";

const STAFF_ROLES = ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN"];

export function MobileNav({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation completes.
  React.useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/feed", label: "Ballina", icon: Home },
    { href: "/explore", label: "Eksploro", icon: Compass },
    { href: "/map", label: "Harta", icon: Map },
    ...(user ? [{ href: "/reports/new", label: "Raporto problem", icon: Plus }] : []),
    ...(user && STAFF_ROLES.includes(user.role)
      ? [{ href: "/municipality", label: "Paneli komunal", icon: Building2 }]
      : []),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Administrimi", icon: Shield }] : []),
    ...(user ? [{ href: "/settings", label: "Cilësimet", icon: Settings }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Hap menynë">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3" aria-label="Navigimi mobil">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <link.icon className="size-[18px]" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </nav>
        {!user ? (
          <div className="flex flex-col gap-2 border-t p-4">
            <Button asChild>
              <Link href="/register">Regjistrohu</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Kyçu</Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
