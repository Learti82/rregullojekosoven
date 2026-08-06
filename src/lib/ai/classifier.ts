/**
 * Heuristic classification layer.
 *
 * This is the seam where a real model plugs in later. Every consumer talks to
 * these three functions, so swapping the keyword heuristics for a hosted
 * vision/text model means reimplementing the bodies — no call site changes.
 * Results are advisory: they are written to `reports.ai_*` columns and shown as
 * suggestions, never used to overwrite what the citizen chose.
 *
 * See `src/lib/ai/README.md` for the intended model integration.
 */

import type { ReportPriority } from "@prisma/client";

export type CategorySuggestion = {
  slug: string;
  confidence: number;
};

/** Keyword → category slug, in Albanian and the common English equivalents. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "rruge-te-demtuara": [
    "gropë",
    "grope",
    "gropa",
    "asfalt",
    "rrugë",
    "rruge",
    "trotuar",
    "pothole",
    "road",
  ],
  mbeturina: ["mbeturina", "plehra", "kontejner", "mbeturinat", "garbage", "trash", "waste"],
  "ndricim-publik": [
    "ndriçim",
    "ndricim",
    "llamba",
    "shtylla",
    "dritë",
    "drite",
    "street light",
    "lamp",
  ],
  "rrjedhje-uji": ["ujë", "uje", "rrjedhje", "gyp", "kanalizim", "water", "leak", "sewer"],
  "hedhje-ilegale": ["deponi", "ilegale", "hedhje", "illegal dumping", "landfill"],
  "prona-publike": ["stol", "park", "shatërvan", "shatervan", "lodra", "bench", "playground"],
  "siguri-ne-trafik": ["semafor", "sinjalistikë", "sinjalistike", "vijat", "traffic", "sign"],
  gjelberim: ["pemë", "peme", "gjelbërim", "gjelberim", "bar", "tree", "green"],
};

/** Words that reliably indicate danger to people, used for priority. */
const CRITICAL_KEYWORDS = [
  "rrezik",
  "aksident",
  "fëmijë",
  "femije",
  "shkollë",
  "shkolle",
  "spital",
  "zjarr",
  "shpërthim",
  "shperthim",
  "urgjent",
  "i rrezikshëm",
  "danger",
  "emergency",
];

const HIGH_KEYWORDS = [
  "e madhe",
  "thellë",
  "thelle",
  "bllokuar",
  "shumë",
  "shume",
  "gjithë lagjja",
  "prej muajsh",
  "kalimtarë",
  "kalimtare",
];

function normalise(text: string): string {
  return text.toLowerCase().normalize("NFC");
}

/**
 * Suggest a category from free text.
 * Returns `null` when nothing matches strongly enough to be worth showing.
 */
export function suggestCategory(text: string): CategorySuggestion | null {
  const haystack = normalise(text);
  let best: CategorySuggestion | null = null;

  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = keywords.filter((keyword) => haystack.includes(normalise(keyword))).length;
    if (hits === 0) continue;
    // Saturating confidence: 1 hit ≈ 0.45, 3+ hits ≈ 0.9.
    const confidence = Math.min(0.9, 0.3 + hits * 0.2);
    if (!best || confidence > best.confidence) best = { slug, confidence };
  }

  return best && best.confidence >= 0.45 ? best : null;
}

export function predictPriority(input: {
  title: string;
  description: string;
  categorySlug?: string;
}): ReportPriority {
  const haystack = normalise(`${input.title} ${input.description}`);

  if (CRITICAL_KEYWORDS.some((word) => haystack.includes(normalise(word)))) return "CRITICAL";
  if (HIGH_KEYWORDS.some((word) => haystack.includes(normalise(word)))) return "HIGH";
  // Water and traffic faults escalate faster than cosmetic issues.
  if (input.categorySlug === "rrjedhje-uji" || input.categorySlug === "siguri-ne-trafik") {
    return "HIGH";
  }
  if (input.categorySlug === "gjelberim") return "LOW";
  return "MEDIUM";
}

/**
 * Similarity score in [0,1] between two reports, combining title overlap and
 * physical distance. Used to surface likely duplicates to municipal staff.
 */
export function duplicateScore(
  a: { title: string; latitude: number; longitude: number },
  b: { title: string; latitude: number; longitude: number },
  distanceKm: number
): number {
  const tokens = (text: string) =>
    new Set(
      normalise(text)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3)
    );

  const setA = tokens(a.title);
  const setB = tokens(b.title);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Proximity decays to zero at 1km.
  const proximity = Math.max(0, 1 - distanceKm / 1);

  return Number((jaccard * 0.6 + proximity * 0.4).toFixed(3));
}

/**
 * Placeholder for image-based classification.
 *
 * Returns `null` until a vision model is wired in; callers already handle a
 * null result, so enabling it later is additive.
 */
export async function classifyImage(_imageUrl: string): Promise<CategorySuggestion | null> {
  return null;
}
