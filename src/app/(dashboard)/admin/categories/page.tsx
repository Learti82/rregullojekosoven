import type { Metadata } from "next";
import { requireRole } from "@/lib/permissions";
import { getAllCategories } from "@/server/queries/taxonomy";
import { Badge } from "@/components/ui/badge";
import { CategoryDialog, DeleteCategoryButton } from "@/components/dashboard/category-dialog";

export const metadata: Metadata = {
  title: "Kategoritë",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await getAllCategories();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kategoritë</h1>
          <p className="mt-1.5 text-muted-foreground">
            Llojet e problemeve që qytetarët mund të raportojnë.
          </p>
        </div>
        <CategoryDialog />
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="font-medium">{category.name}</span>
              </div>
              <Badge variant={category.isActive ? "success" : "secondary"}>
                {category.isActive ? "Aktive" : "Joaktive"}
              </Badge>
            </div>

            {category.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
            ) : null}

            <p className="mt-3 text-xs text-muted-foreground tabular-nums">
              {category._count.reports} raporte
            </p>

            <div className="mt-4 flex gap-2">
              <CategoryDialog
                category={{
                  id: category.id,
                  name: category.name,
                  description: category.description,
                  icon: category.icon,
                  color: category.color,
                  sortOrder: category.sortOrder,
                  isActive: category.isActive,
                }}
              />
              <DeleteCategoryButton id={category.id} hasReports={category._count.reports > 0} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
