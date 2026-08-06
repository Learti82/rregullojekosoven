import { describe, expect, it } from "vitest";
import {
  slugify,
  isInsideKosovo,
  haversineKm,
  truncate,
  initials,
  formatBytes,
  formatDuration,
  safeRedirectPath,
  escapeHtml,
} from "@/lib/utils";

describe("slugify", () => {
  it("transliterates Albanian characters instead of dropping them", () => {
    expect(slugify("Prishtinë")).toBe("prishtine");
    expect(slugify("Kaçanik")).toBe("kacanik");
    expect(slugify("Fushë Kosovë")).toBe("fushe-kosove");
    expect(slugify("Gjelbërim")).toBe("gjelberim");
  });

  it("collapses punctuation and whitespace", () => {
    expect(slugify("  Rrugë   të  dëmtuara!! ")).toBe("rruge-te-demtuara");
  });

  it("caps length so slugs stay index-friendly", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("isInsideKosovo", () => {
  it("accepts coordinates within the country", () => {
    expect(isInsideKosovo(42.6629, 21.1655)).toBe(true); // Prishtina
    expect(isInsideKosovo(42.2139, 20.7397)).toBe(true); // Prizren
  });

  it("rejects coordinates outside it", () => {
    expect(isInsideKosovo(41.3275, 19.8187)).toBe(false); // Tirana
    expect(isInsideKosovo(0, 0)).toBe(false);
    expect(isInsideKosovo(48.8566, 2.3522)).toBe(false); // Paris
  });
});

describe("haversineKm", () => {
  it("returns zero for identical points", () => {
    expect(haversineKm({ lat: 42.66, lng: 21.16 }, { lat: 42.66, lng: 21.16 })).toBe(0);
  });

  it("approximates the Prishtina–Prizren distance", () => {
    const distance = haversineKm(
      { lat: 42.6629, lng: 21.1655 },
      { lat: 42.2139, lng: 20.7397 }
    );
    // Straight-line distance is roughly 60km.
    expect(distance).toBeGreaterThan(55);
    expect(distance).toBeLessThan(65);
  });
});

describe("safeRedirectPath", () => {
  it("keeps relative paths", () => {
    expect(safeRedirectPath("/reports/new")).toBe("/reports/new");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/feed");
    expect(safeRedirectPath("//evil.example")).toBe("/feed");
    expect(safeRedirectPath(null)).toBe("/feed");
  });
});

describe("misc formatters", () => {
  it("truncates with an ellipsis only when needed", () => {
    expect(truncate("short", 20)).toBe("short");
    expect(truncate("a".repeat(30), 10)).toHaveLength(10);
  });

  it("builds initials from at most two words", () => {
    expect(initials("Arta Krasniqi")).toBe("AK");
    expect(initials("Arta Blerta Krasniqi")).toBe("AB");
    expect(initials("Arta")).toBe("A");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats durations across unit boundaries", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.5)).toBe("30 min");
    expect(formatDuration(10)).toBe("10 orë");
    expect(formatDuration(72)).toBe("3 ditë");
  });

  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});
