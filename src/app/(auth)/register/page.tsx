import type { Metadata } from "next";
import Link from "next/link";
import { getMunicipalities } from "@/server/queries/taxonomy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Regjistrohu",
  description:
    "Krijoni llogari falas në RregulloKosovën për të raportuar probleme publike në komunën tuaj.",
  robots: { index: false, follow: false },
};

/**
 * Rendered per request rather than prerendered.
 *
 * The municipality list comes from the database, so prerendering this page at
 * build time makes the build itself depend on database connectivity — a clean
 * CI build fails outright when the database is unreachable, and managed
 * Postgres (Neon's free tier included) sleeps when idle. The query underneath
 * is cached for an hour by `unstable_cache`, so per-request rendering costs
 * effectively nothing.
 */
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const municipalities = await getMunicipalities();

  return (
    <Card className="border-none shadow-none sm:border sm:shadow-subtle">
      <CardHeader className="px-0 sm:px-6">
        <CardTitle className="text-2xl">Krijo llogari</CardTitle>
        <CardDescription>
          Falas, pa reklama. Të duhen vetëm 30 sekonda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0 sm:px-6">
        <RegisterForm municipalities={municipalities} />

        <p className="text-center text-sm text-muted-foreground">
          Keni llogari?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Kyçuni këtu
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
