import { SiteHeader } from "@/components/layout/site-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireRole } from "@/lib/permissions";

/**
 * Dashboard shell. `requireRole` is a second gate behind middleware: middleware
 * can be bypassed by a direct RSC request, this cannot.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="container flex-1 py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <DashboardNav role={user.role} />
          <main id="main" className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
