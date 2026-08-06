"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE_LINKS = [
  { href: "/feed", label: "Ballina" },
  { href: "/explore", label: "Eksploro" },
  { href: "/map", label: "Harta" },
] as const;

const STAFF_ROLES = ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN"];

export function MainNav({ className, role }: { className?: string; role: string | null }) {
  const pathname = usePathname();

  const links = [
    ...BASE_LINKS,
    ...(role && STAFF_ROLES.includes(role) ? [{ href: "/municipality", label: "Paneli" } as const] : []),
    ...(role === "ADMIN" ? [{ href: "/admin", label: "Admin" } as const] : []),
  ];

  return (
    <nav className={cn("items-center gap-1", className)} aria-label="Navigimi kryesor">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
