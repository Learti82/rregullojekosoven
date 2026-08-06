import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getCategories, getMunicipalities } from "@/server/queries/taxonomy";
import { isStorageConfigured } from "@/lib/storage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { CreateReportForm } from "@/components/reports/create-report-form";

export const metadata: Metadata = {
  title: "Raporto një problem",
  description: "Raportoni një problem publik në komunën tuaj në më pak se një minutë.",
  robots: { index: false, follow: false },
};

export default async function NewReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/reports/new");

  const [municipalities, categories] = await Promise.all([getMunicipalities(), getCategories()]);

  return (
    <div className="container max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Raporto një problem</h1>
        <p className="mt-1.5 text-muted-foreground">
          Sa më i saktë përshkrimi dhe vendndodhja, aq më shpejt reagon komuna.
        </p>
      </header>

      {!isStorageConfigured ? (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Ngarkimi i fotove është i çaktivizuar</AlertTitle>
          <AlertDescription>
            Ruajtja e skedarëve nuk është konfiguruar në këtë mjedis. Mund ta dërgoni raportin pa
            foto — shihni udhëzuesin e vendosjes për të aktivizuar Cloudflare R2.
          </AlertDescription>
        </Alert>
      ) : null}

      <CreateReportForm
        municipalities={municipalities}
        categories={categories}
        defaultMunicipalityId={user.municipalityId ?? ""}
        uploadsEnabled={isStorageConfigured}
      />
    </div>
  );
}
