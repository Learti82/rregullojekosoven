import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Structural guards for mistakes that type-check and build cleanly but degrade
 * the running app. Both of these have actually bitten this codebase.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

const ALL_FILES = walk(SRC);

/**
 * Modules that touch `window` at import time (Leaflet and its plugins do).
 * Anything importing these statically must itself be loaded via `next/dynamic`
 * with `ssr: false`, or the server render crashes and the bundle balloons.
 */
const LEAFLET_MODULES = [
  "@/components/map/reports-map",
  "@/components/map/location-picker",
  "@/components/map/municipality-boundaries",
];

/** The only files allowed to import those directly. */
const ALLOWED_LEAFLET_IMPORTERS = [
  "components/map/dynamic-map.tsx", // the ssr:false boundary itself
  "components/map/reports-map.tsx", // composes the boundary layer into the map
];

describe("Leaflet stays out of server-rendered bundles", () => {
  it("only the dynamic-map boundary imports Leaflet-backed modules", () => {
    const offenders: string[] = [];

    for (const file of ALL_FILES) {
      const rel = relative(SRC, file);
      if (ALLOWED_LEAFLET_IMPORTERS.includes(rel)) continue;

      const source = readFileSync(file, "utf8");
      for (const target of LEAFLET_MODULES) {
        // Value imports only. `import(...)` inside next/dynamic is the
        // intended escape hatch, and `import type` is erased at compile time,
        // so neither pulls Leaflet into a bundle.
        const staticImport = new RegExp(
          `import\\s+(?!type\\s)[^;]*?from\\s+["']${target.replace(/[/@]/g, "\\$&")}["']`
        );
        if (staticImport.test(source)) offenders.push(`${rel} -> ${target}`);
      }
    }

    expect(
      offenders,
      `These files statically import a Leaflet module. Move the shared piece into a Leaflet-free file (see boundary-legend.tsx) or import via @/components/map/dynamic-map:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});

/**
 * A `loading.tsx` commits the HTTP response before rendering finishes, which
 * downgrades `notFound()` to a soft 404 — a 200 with not-found content, which
 * search engines happily index.
 */
describe("routes calling notFound() have no loading.tsx above them", () => {
  it("no notFound() route sits under a loading boundary", () => {
    const appDir = join(SRC, "app");
    const pages = ALL_FILES.filter(
      (f) => f.startsWith(appDir) && f.endsWith("page.tsx")
    );

    const notFoundPages = pages.filter((f) =>
      /\bnotFound\(\)/.test(readFileSync(f, "utf8"))
    );

    // Sanity: the guard is worthless if it matches nothing.
    expect(notFoundPages.length).toBeGreaterThan(0);

    const loadingFiles = new Set(
      ALL_FILES.filter((f) => f.endsWith("loading.tsx")).map((f) => join(f, ".."))
    );

    const offenders: string[] = [];
    for (const page of notFoundPages) {
      // Walk from the page's own segment up to src/app.
      let dir = join(page, "..");
      while (dir.startsWith(appDir)) {
        if (loadingFiles.has(dir)) {
          offenders.push(`${relative(SRC, page)} is under ${relative(SRC, dir)}/loading.tsx`);
        }
        dir = join(dir, "..");
      }
    }

    expect(
      offenders,
      `A loading.tsx above a notFound() route turns missing pages into soft 404s:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
