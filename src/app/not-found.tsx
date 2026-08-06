import Link from "next/link";
import { Compass, Home, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Link href="/" className="mb-10">
        <Logo />
      </Link>

      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <MapPinOff className="size-7 text-muted-foreground" aria-hidden />
      </div>

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Faqja nuk u gjet</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Kjo adresë nuk ekziston, ose raporti që kërkoni është fshirë.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home /> Kthehu në ballinë
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/explore">
            <Compass /> Eksploro raportet
          </Link>
        </Button>
      </div>
    </div>
  );
}
