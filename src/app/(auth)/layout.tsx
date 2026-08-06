import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { APP_TAGLINE } from "@/lib/constants";

const HIGHLIGHTS = [
  "Raporto në më pak se 30 sekonda",
  "Ndiq statusin deri në zgjidhje",
  "Bashko zërin me qytetarët e tjerë",
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — decorative, hidden on small screens. */}
      <aside className="gradient-civic relative hidden flex-col justify-between p-12 text-white lg:flex">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-white">
          <Logo textClassName="text-white" />
        </Link>

        <div>
          <h1 className="text-balance font-display text-4xl font-bold leading-tight">
            {APP_TAGLINE}
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Platforma qytetare që lidh banorët e Kosovës me komunat e tyre.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} RregulloKosovën
        </p>
      </aside>

      <main id="main" className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>

          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Kthehu në ballinë
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
