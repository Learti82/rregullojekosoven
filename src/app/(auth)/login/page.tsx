import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Kyçu",
  description: "Kyçuni në llogarinë tuaj për të raportuar dhe ndjekur problemet publike.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card className="border-none shadow-none sm:border sm:shadow-subtle">
      <CardHeader className="px-0 sm:px-6">
        <CardTitle className="text-2xl">Mirë se u ktheve</CardTitle>
        <CardDescription>
          Kyçu për të raportuar probleme dhe për të ndjekur zgjidhjen e tyre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0 sm:px-6">
        <LoginForm
          callbackUrl={params.callbackUrl}
          justRegistered={params.registered === "1"}
        />

        <p className="text-center text-sm text-muted-foreground">
          Nuk keni llogari?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regjistrohu falas
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
