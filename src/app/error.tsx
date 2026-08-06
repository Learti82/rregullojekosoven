"use client";

import * as React from "react";
import Link from "next/link";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. `digest` is the only detail safe to surface —
 * it lets an operator find the matching server log without leaking a stack.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-7 text-destructive" aria-hidden />
      </div>

      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">Diçka shkoi keq</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Ndodhi një gabim i papritur gjatë ngarkimit të kësaj faqeje. Provoni sërish — nëse problemi
        vazhdon, na njoftoni.
      </p>

      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">Kodi: {error.digest}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw /> Provo sërish
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home /> Ballina
          </Link>
        </Button>
      </div>
    </div>
  );
}
