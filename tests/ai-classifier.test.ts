import { describe, expect, it } from "vitest";
import { suggestCategory, predictPriority, duplicateScore } from "@/lib/ai/classifier";

describe("suggestCategory", () => {
  it("recognises road damage from Albanian keywords", () => {
    const result = suggestCategory("Ka një gropë të madhe në asfalt te rruga kryesore");
    expect(result?.slug).toBe("rruge-te-demtuara");
  });

  it("recognises waste reports", () => {
    expect(suggestCategory("Kontejnerët me mbeturina nuk zbrazen")?.slug).toBe("mbeturina");
  });

  it("recognises street lighting", () => {
    expect(suggestCategory("Llamba e ndriçimit publik nuk ndizet")?.slug).toBe("ndricim-publik");
  });

  it("returns null when nothing matches confidently", () => {
    expect(suggestCategory("Përshëndetje, si jeni sot?")).toBeNull();
  });

  it("reports confidence within [0,1]", () => {
    const result = suggestCategory("gropë asfalt rrugë trotuar");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });
});

describe("predictPriority", () => {
  it("escalates danger keywords to CRITICAL", () => {
    expect(
      predictPriority({
        title: "Rrezik për fëmijët",
        description: "Ka rrezik aksidenti para shkollës.",
      })
    ).toBe("CRITICAL");
  });

  it("treats water and traffic categories as HIGH by default", () => {
    expect(
      predictPriority({ title: "Gyp", description: "Ujë rrjedh.", categorySlug: "rrjedhje-uji" })
    ).toBe("HIGH");
    expect(
      predictPriority({
        title: "Semafor",
        description: "Nuk punon.",
        categorySlug: "siguri-ne-trafik",
      })
    ).toBe("HIGH");
  });

  it("treats greenery as LOW", () => {
    expect(
      predictPriority({ title: "Bar", description: "Bari i gjatë.", categorySlug: "gjelberim" })
    ).toBe("LOW");
  });

  it("defaults to MEDIUM", () => {
    expect(predictPriority({ title: "Stol i thyer", description: "Stoli te parku." })).toBe(
      "MEDIUM"
    );
  });
});

describe("duplicateScore", () => {
  const a = { title: "Gropë e madhe në rrugën kryesore", latitude: 42.66, longitude: 21.16 };

  it("scores near-identical nearby reports highly", () => {
    const b = { title: "Gropë e madhe në rrugën kryesore", latitude: 42.66, longitude: 21.16 };
    expect(duplicateScore(a, b, 0)).toBeGreaterThan(0.8);
  });

  it("scores unrelated distant reports low", () => {
    const b = { title: "Llamba nuk ndizet te parku", latitude: 42.2, longitude: 20.7 };
    expect(duplicateScore(a, b, 50)).toBeLessThan(0.3);
  });

  it("stays within [0,1]", () => {
    const b = { title: "Gropë tjetër", latitude: 42.661, longitude: 21.161 };
    const score = duplicateScore(a, b, 0.2);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
