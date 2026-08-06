import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * `src/lib/ads.ts` reads its number at module load, so each case sets the env
 * var and re-imports with a fresh module registry.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_ADS_WHATSAPP;

async function loadAds(number?: string) {
  vi.resetModules();
  if (number === undefined) delete process.env.NEXT_PUBLIC_ADS_WHATSAPP;
  else process.env.NEXT_PUBLIC_ADS_WHATSAPP = number;
  return import("@/lib/ads");
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_ADS_WHATSAPP;
  else process.env.NEXT_PUBLIC_ADS_WHATSAPP = ORIGINAL;
});

describe("WhatsApp contact link", () => {
  it("builds a wa.me link with a slot-specific prefilled message", async () => {
    const ads = await loadAds("38344123456");
    const link = ads.buildWhatsAppLink(ads.AD_SLOTS["home-hero"]);

    expect(link).toBeTruthy();
    expect(link).toContain("https://wa.me/38344123456");
    // The slot label must survive URL-encoding so the owner knows what was clicked.
    expect(decodeURIComponent(link!)).toContain("Banderolë në ballinë");
  });

  it("builds a generic link when no slot is given", async () => {
    const ads = await loadAds("38344123456");
    const link = ads.buildWhatsAppLink();
    expect(link).toContain("https://wa.me/38344123456");
    expect(decodeURIComponent(link!)).toContain("RregulloKosovën");
  });

  it("strips spaces, plus signs and punctuation from the configured number", async () => {
    const ads = await loadAds("+383 44 123 456");
    expect(ads.ADS_WHATSAPP_NUMBER).toBe("38344123456");
    expect(ads.buildWhatsAppLink()).toContain("wa.me/38344123456");
  });

  it("returns null rather than a broken link when no number is configured", async () => {
    const ads = await loadAds("");
    expect(ads.hasWhatsAppContact).toBe(false);
    expect(ads.buildWhatsAppLink()).toBeNull();
    expect(ads.formatWhatsAppNumber()).toBeNull();
  });

  it("rejects an obviously incomplete number", async () => {
    const ads = await loadAds("1234");
    expect(ads.hasWhatsAppContact).toBe(false);
    expect(ads.buildWhatsAppLink()).toBeNull();
  });

  it("formats Kosovo numbers for display", async () => {
    const ads = await loadAds("38344123456");
    expect(ads.formatWhatsAppNumber()).toBe("+383 44 123 456");
  });

  it("falls back to a plain international format for non-Kosovo numbers", async () => {
    const ads = await loadAds("447700900123");
    expect(ads.formatWhatsAppNumber()).toBe("+447700900123");
  });
});

describe("ad slot inventory", () => {
  it("every slot id maps to a definition with matching id", async () => {
    const ads = await loadAds("38344123456");
    for (const [id, slot] of Object.entries(ads.AD_SLOTS)) {
      expect(slot.id).toBe(id);
      expect(slot.label.length).toBeGreaterThan(0);
      expect(slot.placement.length).toBeGreaterThan(0);
      expect(["leaderboard", "rectangle", "sidebar"]).toContain(slot.format);
    }
  });

  it("ships with no slots pre-sold", async () => {
    const ads = await loadAds("38344123456");
    expect(Object.keys(ads.BOOKED_SLOTS)).toHaveLength(0);
  });
});
