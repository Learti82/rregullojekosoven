/**
 * Advertising configuration.
 *
 * Ad slots are placeholders shown to potential advertisers: each one invites a
 * person or company to book that space, and the call-to-action opens WhatsApp
 * to the platform owner. Once a slot is sold, fill in the matching entry in
 * `BOOKED_SLOTS` below and the placeholder is replaced by the real creative.
 *
 * The contact number lives in one place — `NEXT_PUBLIC_ADS_WHATSAPP` — so it can
 * be changed without touching any component.
 */

/**
 * WhatsApp number in international format, digits only, no `+` and no spaces.
 * Kosovo numbers start with the country code 383, e.g. `38344123456`.
 *
 * Left empty until the real number is supplied: the UI then falls back to a
 * plain "contact us" state rather than rendering a broken wa.me link.
 */
export const ADS_WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_ADS_WHATSAPP ?? "").replace(
  /[^0-9]/g,
  ""
);

export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== "false";

/** True once a real number is configured. */
export const hasWhatsAppContact = ADS_WHATSAPP_NUMBER.length >= 8;

/** Every placement on the site, so inventory is described in one list. */
export type AdSlotId =
  | "home-hero"
  | "feed-inline"
  | "explore-inline"
  | "report-sidebar"
  | "map-sidebar"
  | "footer-banner";

export type AdSlotDefinition = {
  id: AdSlotId;
  /** Shown to advertisers so they know what they are buying. */
  label: string;
  placement: string;
  /** Rough render size, used to pick the right layout variant. */
  format: "leaderboard" | "rectangle" | "sidebar";
};

export const AD_SLOTS: Record<AdSlotId, AdSlotDefinition> = {
  "home-hero": {
    id: "home-hero",
    label: "Banderolë në ballinë",
    placement: "Ballina, nën statistikat kryesore",
    format: "leaderboard",
  },
  "feed-inline": {
    id: "feed-inline",
    label: "Hapësirë në rrjedhën e raporteve",
    placement: "Mes kartelave të raporteve në ballinën e përdoruesit",
    format: "rectangle",
  },
  "explore-inline": {
    id: "explore-inline",
    label: "Hapësirë në eksplorim",
    placement: "Mes rezultateve të kërkimit",
    format: "rectangle",
  },
  "report-sidebar": {
    id: "report-sidebar",
    label: "Anësore te raporti",
    placement: "Faqja e raportit, kolona e djathtë",
    format: "sidebar",
  },
  "map-sidebar": {
    id: "map-sidebar",
    label: "Anësore te harta",
    placement: "Faqja e hartës, paneli anësor",
    format: "sidebar",
  },
  "footer-banner": {
    id: "footer-banner",
    label: "Banderolë në fund të faqes",
    placement: "Mbi footer-in, në të gjitha faqet publike",
    format: "leaderboard",
  },
};

/**
 * A sold slot. Add an entry here to replace the placeholder with real creative.
 * `href` is the advertiser's own link; leave it out to make the ad non-clickable.
 */
export type BookedAd = {
  advertiser: string;
  headline: string;
  body?: string;
  imageUrl?: string;
  href?: string;
};

export const BOOKED_SLOTS: Partial<Record<AdSlotId, BookedAd>> = {
  // Example once a slot is sold:
  // "home-hero": {
  //   advertiser: "Kompania Shembull",
  //   headline: "Materiale ndërtimi për çdo projekt",
  //   body: "Dërgesa falas brenda Prishtinës.",
  //   href: "https://shembull.com",
  // },
};

/**
 * Build a `wa.me` link that opens WhatsApp with a pre-filled enquiry naming the
 * exact slot, so the owner immediately knows which space the sender means.
 */
export function buildWhatsAppLink(slot?: AdSlotDefinition): string | null {
  if (!hasWhatsAppContact) return null;

  const message = slot
    ? `Përshëndetje! Jam i interesuar të reklamoj në RregulloKosovën — hapësira "${slot.label}" (${slot.placement}).`
    : "Përshëndetje! Jam i interesuar për reklamim në RregulloKosovën.";

  return `https://wa.me/${ADS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Display form of the configured number, e.g. +383 44 123 456. */
export function formatWhatsAppNumber(): string | null {
  if (!hasWhatsAppContact) return null;
  const digits = ADS_WHATSAPP_NUMBER;
  if (digits.startsWith("383") && digits.length >= 11) {
    return `+383 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}
