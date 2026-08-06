import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { getActivityLogs } from "@/server/queries/users";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = {
  title: "Regjistrat e aktivitetit",
  robots: { index: false, follow: false },
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const result = await getActivityLogs(Math.max(1, Number(params.page) || 1));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Regjistrat e aktivitetit</h1>
        <p className="mt-1.5 text-muted-foreground">
          Gjurmë auditimi e veprimeve në platformë. Adresat IP ruhen vetëm të hash-uara.
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="Asnjë regjistrim" description="Aktiviteti do të shfaqet këtu." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Regjistrat e aktivitetit</caption>
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Veprimi</th>
                  <th scope="col" className="px-4 py-3 font-medium">Përdoruesi</th>
                  <th scope="col" className="px-4 py-3 font-medium">Entiteti</th>
                  <th scope="col" className="px-4 py-3 font-medium">Koha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.items.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <Link
                          href={`/profile/${log.user.username}`}
                          className="hover:text-primary"
                        >
                          {log.user.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Sistemi</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.entityType}
                      {log.entityId ? (
                        <span className="ml-1 font-mono text-xs">{log.entityId.slice(0, 8)}…</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={result.page} totalPages={result.totalPages} />
        </>
      )}
    </div>
  );
}
