import type { Metadata } from "next";
import { requireRole } from "@/lib/permissions";
import { getAllMunicipalities } from "@/server/queries/taxonomy";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MunicipalityDialog } from "@/components/dashboard/municipality-dialog";

export const metadata: Metadata = {
  title: "Komunat",
  robots: { index: false, follow: false },
};

export default async function AdminMunicipalitiesPage() {
  await requireRole("ADMIN");
  const municipalities = await getAllMunicipalities();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Komunat</h1>
          <p className="mt-1.5 text-muted-foreground">
            {formatNumber(municipalities.length)} komuna në sistem.
          </p>
        </div>
        <MunicipalityDialog />
      </header>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Lista e komunave</caption>
          <thead className="bg-muted/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Emri</th>
              <th scope="col" className="px-4 py-3 font-medium">Rajoni</th>
              <th scope="col" className="px-4 py-3 font-medium">Popullsia</th>
              <th scope="col" className="px-4 py-3 font-medium">Raporte</th>
              <th scope="col" className="px-4 py-3 font-medium">Përdorues</th>
              <th scope="col" className="px-4 py-3 font-medium">Statusi</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Veprime</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {municipalities.map((municipality) => (
              <tr key={municipality.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{municipality.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{municipality.region}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {municipality.population ? formatNumber(municipality.population) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{municipality._count.reports}</td>
                <td className="px-4 py-3 tabular-nums">{municipality._count.users}</td>
                <td className="px-4 py-3">
                  <Badge variant={municipality.isActive ? "success" : "secondary"}>
                    {municipality.isActive ? "Aktive" : "Joaktive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <MunicipalityDialog
                    municipality={{
                      id: municipality.id,
                      name: municipality.name,
                      region: municipality.region,
                      population: municipality.population,
                      latitude: municipality.latitude,
                      longitude: municipality.longitude,
                      email: municipality.email,
                      phone: municipality.phone,
                      website: municipality.website,
                      isActive: municipality.isActive,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
