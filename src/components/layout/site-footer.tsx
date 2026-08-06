import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { APP_DESCRIPTION } from "@/lib/constants";
import { AdSlot, AdvertiseWithUs } from "@/components/ads/ad-slot";

const SECTIONS = [
  {
    title: "Platforma",
    links: [
      { href: "/explore", label: "Eksploro raportet" },
      { href: "/map", label: "Harta e problemeve" },
      { href: "/reports/new", label: "Raporto problem" },
      { href: "/about", label: "Rreth nesh" },
    ],
  },
  {
    title: "Llogaria",
    links: [
      { href: "/login", label: "Kyçu" },
      { href: "/register", label: "Regjistrohu" },
      { href: "/notifications", label: "Njoftimet" },
      { href: "/settings", label: "Cilësimet" },
    ],
  },
  {
    title: "Ligjore",
    links: [
      { href: "/privacy", label: "Privatësia" },
      { href: "/terms", label: "Kushtet e përdorimit" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 no-print">
      <div className="container py-12">
        <AdSlot id="footer-banner" className="mb-10" />

        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {APP_DESCRIPTION}
            </p>
            <AdvertiseWithUs className="mt-5 max-w-xs" />
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RregulloKosovën. Ndërtuar për qytetarët e Kosovës.</p>
          <p>
            Të dhënat e hartës ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              OpenStreetMap
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
