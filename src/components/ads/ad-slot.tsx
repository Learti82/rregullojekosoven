import Image from "next/image";
import { MessageCircle, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AD_SLOTS,
  ADS_ENABLED,
  BOOKED_SLOTS,
  buildWhatsAppLink,
  formatWhatsAppNumber,
  hasWhatsAppContact,
  type AdSlotId,
} from "@/lib/ads";

/**
 * An advertising placement.
 *
 * While a slot is unsold it renders as an invitation to advertise, with a
 * WhatsApp call-to-action that opens a chat with the platform owner and a
 * pre-filled message naming this exact slot. Once the slot is booked (see
 * `BOOKED_SLOTS`), the same component renders the advertiser's creative.
 *
 * Server component: no JavaScript ships for an ad placement.
 */
export function AdSlot({
  id,
  className,
  /** Hide entirely on small screens where space is tight. */
  hideOnMobile = false,
}: {
  id: AdSlotId;
  className?: string;
  hideOnMobile?: boolean;
}) {
  if (!ADS_ENABLED) return null;

  const slot = AD_SLOTS[id];
  const booked = BOOKED_SLOTS[id];
  const whatsappLink = buildWhatsAppLink(slot);
  const displayNumber = formatWhatsAppNumber();

  const wrapper = cn(
    "not-prose",
    hideOnMobile && "hidden sm:block",
    className
  );

  // ---------------------------------------------------------------- sold
  if (booked) {
    const content = (
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-elevated",
          slot.format === "leaderboard" ? "flex items-center gap-4 p-4" : "p-4"
        )}
      >
        {booked.imageUrl ? (
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-lg bg-muted",
              slot.format === "leaderboard" ? "size-16" : "mb-3 aspect-[16/9] w-full"
            )}
          >
            <Image
              src={booked.imageUrl}
              alt={booked.advertiser}
              fill
              sizes={slot.format === "leaderboard" ? "64px" : "(max-width: 640px) 100vw, 320px"}
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-snug">{booked.headline}</p>
          {booked.body ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{booked.body}</p>
          ) : null}
          <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Reklamë · {booked.advertiser}
          </p>
        </div>
      </div>
    );

    return (
      <aside className={wrapper} aria-label="Reklamë">
        {booked.href ? (
          <a
            href={booked.href}
            target="_blank"
            // `sponsored` tells search engines this is paid placement.
            rel="noopener noreferrer sponsored"
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </aside>
    );
  }

  // ------------------------------------------------------------- available
  const invitation = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed bg-muted/30 transition-colors",
        hasWhatsAppContact && "hover:border-primary/50 hover:bg-primary/[0.04]",
        slot.format === "leaderboard"
          ? "flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left"
          : "flex flex-col items-center p-5 text-center"
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Megaphone className="size-5 text-primary" aria-hidden />
      </div>

      <div className={cn("min-w-0 flex-1", slot.format !== "leaderboard" && "mt-3")}>
        <p className="text-sm font-semibold">Hapësirë e lirë për reklamë</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Promovoni biznesin tuaj para qytetarëve të Kosovës.
          {slot.format !== "sidebar" ? ` ${slot.placement}.` : ""}
        </p>
      </div>

      {hasWhatsAppContact ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white shadow-subtle transition-transform group-hover:scale-[1.02]",
            slot.format !== "leaderboard" && "mt-4"
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
          Kontakto në WhatsApp
        </span>
      ) : (
        <span
          className={cn(
            "text-xs text-muted-foreground",
            slot.format !== "leaderboard" && "mt-3"
          )}
        >
          Kontakti do të publikohet së shpejti.
        </span>
      )}
    </div>
  );

  return (
    <aside className={wrapper} aria-label="Hapësirë reklamuese e lirë">
      {whatsappLink ? (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Rezervoni hapësirën "${slot.label}" — hap bisedën në WhatsApp${
            displayNumber ? ` me ${displayNumber}` : ""
          }`}
        >
          {invitation}
        </a>
      ) : (
        invitation
      )}
    </aside>
  );
}

/**
 * Compact, always-visible advertising enquiry used in the footer, independent of
 * any particular slot.
 */
export function AdvertiseWithUs({ className }: { className?: string }) {
  if (!ADS_ENABLED) return null;

  const link = buildWhatsAppLink();
  const displayNumber = formatWhatsAppNumber();

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="size-4 text-primary" aria-hidden />
        Reklamoni te ne
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Platforma vizitohet çdo ditë nga qytetarë në të gjitha komunat e Kosovës. Kontaktoni për
        çmimet dhe hapësirat e disponueshme.
      </p>

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MessageCircle className="size-4" aria-hidden />
          {displayNumber ?? "WhatsApp"}
        </a>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Kontakti do të publikohet së shpejti.
        </p>
      )}
    </div>
  );
}
