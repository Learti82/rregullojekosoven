/**
 * Build the municipality boundary overlay shipped to the browser.
 *
 *   node scripts/build-boundaries.mjs <source.geojson>
 *
 * The upstream file (geoBoundaries XKX ADM2, via github.com/Learti82/GeoJSON-Kosova)
 * is ~2.6MB across ~105k coordinate points — far more detail than a municipality
 * outline needs at the zoom levels this map ever shows, and a heavy download on
 * the mobile connections most citizens use.
 *
 * This script:
 *   1. simplifies each ring with Douglas–Peucker at a tolerance chosen to stay
 *      visually identical at z14 while dropping most vertices,
 *   2. rounds coordinates to 5 decimals (~1m — well past what the display needs),
 *   3. reconciles the source's municipality names with the ones this platform
 *      seeds, attaching each feature's `slug` so the overlay can be joined to
 *      report data without a fuzzy match at runtime.
 *
 * Output: public/data/kosovo-municipalities.geojson
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/data/kosovo-municipalities.geojson");

/** ~11m at Kosovo's latitude; invisible at the zoom levels we render. */
const TOLERANCE = 0.0001;
const PRECISION = 5;

/**
 * The source uses a few different official/alternative names than the platform's
 * own municipality list. Mapping them explicitly beats fuzzy matching: a silent
 * mismatch would drop a municipality's boundary with no error.
 */
const NAME_ALIASES = {
  Gllogoc: "Drenas",
  "Mitrovicë e Jugut": "Mitrovicë",
  Skënderaj: "Skenderaj",
};

/** Mirrors slugify() in src/lib/utils.ts so slugs line up with the database. */
function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Perpendicular distance from p to the segment ab, in coordinate units. */
function perpendicularDistance(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + clamped * dx), py - (ay + clamped * dy));
}

/** Iterative Douglas–Peucker (recursion would blow the stack on long rings). */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

const round = (value) => Number(value.toFixed(PRECISION));

/**
 * Simplify one linear ring, keeping it closed and never letting it collapse
 * below the 4 positions GeoJSON requires for a valid ring.
 */
function simplifyRing(ring) {
  let simplified = simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)]);

  // Drop consecutive duplicates introduced by rounding.
  simplified = simplified.filter(
    (p, i) => i === 0 || p[0] !== simplified[i - 1][0] || p[1] !== simplified[i - 1][1]
  );

  const [first] = simplified;
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([...first]);

  // Too degenerate to be a polygon — fall back to the unsimplified ring.
  if (simplified.length < 4) {
    return ring.map(([x, y]) => [round(x), round(y)]);
  }
  return simplified;
}

function simplifyGeometry(geometry) {
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map(simplifyRing) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) => polygon.map(simplifyRing)),
    };
  }
  throw new Error(`Unsupported geometry: ${geometry.type}`);
}

function countPoints(coordinates) {
  if (typeof coordinates[0] === "number") return 1;
  return coordinates.reduce((sum, part) => sum + countPoints(part), 0);
}

// --------------------------------------------------------------------------

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("usage: node scripts/build-boundaries.mjs <source.geojson>");
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
if (source.type !== "FeatureCollection") throw new Error("Expected a FeatureCollection");
if (source.features.length !== 38) {
  throw new Error(`Expected 38 municipalities, found ${source.features.length}`);
}

let pointsBefore = 0;
let pointsAfter = 0;

const features = source.features
  .map((feature) => {
    const sourceName = feature.properties.name;
    const name = NAME_ALIASES[sourceName] ?? sourceName;

    pointsBefore += countPoints(feature.geometry.coordinates);
    const geometry = simplifyGeometry(feature.geometry);
    pointsAfter += countPoints(geometry.coordinates);

    return {
      type: "Feature",
      properties: {
        name,
        slug: slugify(name),
        // Kept so the mapping back to the upstream dataset stays auditable.
        sourceName,
      },
      geometry,
    };
  })
  .sort((a, b) => a.properties.name.localeCompare(b.properties.name, "sq"));

const slugs = new Set(features.map((f) => f.properties.slug));
if (slugs.size !== 38) throw new Error(`Slug collision: ${slugs.size} unique slugs for 38 features`);

const output = { type: "FeatureCollection", features };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));

const bytes = JSON.stringify(output).length;
console.log(`municipalities : ${features.length}`);
console.log(`points         : ${pointsBefore.toLocaleString()} -> ${pointsAfter.toLocaleString()} (${Math.round((1 - pointsAfter / pointsBefore) * 100)}% smaller)`);
console.log(`size           : ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`written        : ${OUT.replace(ROOT + "/", "")}`);
