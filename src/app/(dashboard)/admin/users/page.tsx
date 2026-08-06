import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { getAdminUsers } from "@/server/queries/users";
import { getMunicipalities } from "@/server/queries/taxonomy";
import { adminUserFiltersSchema } from "@/validations/admin";
import { formatDate, formatNumber, initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { UserRowActions } from "@/components/dashboard/user-row-actions";
import { AdminUserFilters } from "@/components/dashboard/admin-user-filters";

export const metadata: Metadata = {
  title: "Menaxhimi i përdoruesve",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const raw = await searchParams;
  const parsed = adminUserFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : adminUserFiltersSchema.parse({});

  const [result, municipalities] = await Promise.all([
    getAdminUsers(filters),
    getMunicipalities(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Përdoruesit</h1>
        <p className="mt-1.5 text-muted-foreground">
          {formatNumber(result.total)} llogari të regjistruara.
        </p>
      </header>

      <AdminUserFilters municipalities={municipalities} />

      {result.items.length === 0 ? (
        <EmptyState icon={UsersRound} title="Asnjë përdorues" description="Provoni filtra të tjerë." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Lista e përdoruesve</caption>
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Përdoruesi</th>
                  <th scope="col" className="px-4 py-3 font-medium">Roli</th>
                  <th scope="col" className="px-4 py-3 font-medium">Komuna</th>
                  <th scope="col" className="px-4 py-3 font-medium">Raporte</th>
                  <th scope="col" className="px-4 py-3 font-medium">Regjistruar</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Veprime</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.items.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${user.username}`}
                            className="block truncate font-medium hover:text-primary"
                          >
                            {user.name}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                        {user.isBanned ? <Badge variant="destructive">Bllokuar</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role.name === "ADMIN" ? "default" : "secondary"}>
                        {ROLE_LABELS[user.role.name] ?? user.role.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.municipality?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{user._count.reports}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(user.createdAt, "d MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserRowActions
                        user={{
                          id: user.id,
                          name: user.name,
                          role: user.role.name,
                          municipalityId: user.municipality?.id ?? null,
                          isBanned: user.isBanned,
                        }}
                        municipalities={municipalities}
                      />
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
