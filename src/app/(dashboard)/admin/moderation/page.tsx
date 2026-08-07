import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { getModerationQueue } from "@/server/queries/reports";
import { formatNumber } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ModerationQueue } from "@/components/dashboard/moderation-queue";

export const metadata: Metadata = {
  title: "Miratimi i raporteve",
  robots: { index: false, follow: false },
};

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = await getModerationQueue(page, 20);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Miratimi i raporteve</h1>
        <p className="mt-1.5 text-muted-foreground">
          {result.total === 0
            ? "Radha është e pastër — asnjë raport nuk pret miratim."
            : `${formatNumber(result.total)} raporte presin vendimin tuaj. Më i vjetri i pari.`}
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Asgjë për të shqyrtuar"
          description="Kur qytetarët dërgojnë raporte të reja, ato shfaqen këtu para se të bëhen publike."
        />
      ) : (
        <>
          <ModerationQueue
            reports={result.items.map((report) => ({
              id: report.id,
              slug: report.slug,
              reference: report.reference,
              title: report.title,
              description: report.description,
              address: report.address,
              latitude: report.latitude,
              longitude: report.longitude,
              isAnonymous: report.isAnonymous,
              createdAt: report.createdAt,
              category: { name: report.category.name, color: report.category.color },
              municipality: { name: report.municipality.name },
              createdBy: {
                name: report.createdBy.name,
                username: report.createdBy.username,
              },
              images: report.images.map((image) => ({
                id: image.id,
                url: image.url,
                caption: image.caption,
              })),
            }))}
          />

          <Pagination page={result.page} totalPages={result.totalPages} />
        </>
      )}
    </div>
  );
}
