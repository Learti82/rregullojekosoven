"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  FolderTree,
  Building2,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MUNICIPALITY_LINKS = [
  { href: "/municipality", label: "Përmbledhje", icon: BarChart3 },
  { href: "/municipality/reports", label: "Raportet", icon: FileText },
  { href: "/municipality/assignments", label: "Detyrat", icon: ClipboardList },
] as const;

const ADMIN_LINKS = [
  { href: "/admin", label: "Analitika", icon: BarChart3 },
  { href: "/admin/reports", label: "Raportet", icon: FileText },
  { href: "/admin/users", label: "Përdoruesit", icon: Users },
  { href: "/admin/municipalities", label: "Komunat", icon: Building2 },
  { href: "/admin/categories", label: "Kategoritë", icon: FolderTree },
  { href: "/admin/logs", label: "Regjistrat", icon: ScrollText },
] as const;

export function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();
  const isAdminArea = pathname.startsWith("/admin");
  const links = isAdminArea ? ADMIN_LINKS : MUNICIPALITY_LINKS;

  return (
    <nav aria-label="Navigimi i panelit" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isAdminArea ? "Administrimi" : "Paneli komunal"}
      </p>

      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin" && link.href !== "/municipality" && pathname.startsWith(link.href));
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {role === "ADMIN" ? (
        <div className="mt-4 border-t pt-4">
          <Link
            href={isAdminArea ? "/municipality" : "/admin"}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isAdminArea ? (
              <>
                <Building2 className="size-4" /> Paneli komunal
              </>
            ) : (
              <>
                <ScrollText className="size-4" /> Administrimi
              </>
            )}
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
