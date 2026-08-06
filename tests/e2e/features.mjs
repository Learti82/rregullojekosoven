/**
 * Verifies the municipality boundary overlay and the advertising slots against
 * a running build.
 *   node tests/e2e/features.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE ?? "http://localhost:3400";
const results = [];
let failures = 0;
const check = (n, ok, d = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
  if (!ok) failures++;
};
async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    check(name, false, String(err.message).split("\n")[0]);
  }
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const go = (p) => page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });

// ------------------------------------------------------------ boundaries
await step("boundary overlay", async () => {
  // Track whether the GeoJSON is fetched, and only when asked for.
  let boundaryRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("kosovo-municipalities.geojson")) boundaryRequests++;
  });

  await go("/map");
  await page.waitForSelector(".leaflet-container", { timeout: 20000 });
  await page.waitForTimeout(2500);

  check("boundaries not fetched until enabled", boundaryRequests === 0, `${boundaryRequests} requests`);
  check("boundary toggle present", (await page.locator("#boundaries").count()) === 1);
  check("no polygons drawn initially", (await page.locator(".leaflet-overlay-pane path").count()) === 0);

  await page.locator("#boundaries").click();
  await page.waitForTimeout(4000);

  check("boundaries fetched once enabled", boundaryRequests === 1, `${boundaryRequests} requests`);

  const polygons = await page.locator(".leaflet-overlay-pane path").count();
  check("38 municipality polygons rendered", polygons >= 38, `${polygons} paths`);
  check("choropleth legend appears", (await page.locator("body").innerText()).includes("Problemet e hapura"));

  // Toggling off and back on must not refetch (module-level cache).
  await page.locator("#boundaries").click();
  await page.waitForTimeout(1200);
  await page.locator("#boundaries").click();
  await page.waitForTimeout(2500);
  check("re-enabling does not refetch", boundaryRequests === 1, `${boundaryRequests} requests`);
  check("polygons restored after toggle", (await page.locator(".leaflet-overlay-pane path").count()) >= 38);

  // Markers must stay clickable above the polygons.
  check("markers still present over boundaries", (await page.locator(".rk-marker, .rk-cluster").count()) > 0);
});

await step("boundary click filters the page", async () => {
  await go("/map");
  await page.waitForSelector(".leaflet-container", { timeout: 20000 });
  await page.locator("#boundaries").click();
  await page.waitForTimeout(4000);

  // Click the polygon the way a user would: at a point confirmed to hit the
  // path itself. A locator click with `force` uses the bounding-box centre,
  // which for an irregular shape can land outside the polygon.
  const point = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".leaflet-overlay-pane path")) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (document.elementFromPoint(x, y) === el) return { x, y };
    }
    return null;
  });
  check("a polygon is hit-testable on screen", point !== null);

  if (point) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(900);
    const tooltip = await page.locator(".leaflet-tooltip").count();
    check("boundary shows a tooltip with report counts", tooltip > 0);
    if (tooltip > 0) {
      const text = await page.locator(".leaflet-tooltip").first().innerText();
      check("tooltip joins municipality stats", /të hapura/.test(text), text.replace(/\n/g, " "));
    }

    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(3000);
    check(
      "clicking a boundary sets the municipality filter",
      page.url().includes("municipality="),
      page.url()
    );
  }
});

// ------------------------------------------------------------------- ads
await step("ad slots render with WhatsApp links", async () => {
  await go("/");
  await page.waitForTimeout(1500);

  const adRegions = await page.locator('aside[aria-label="Hapësirë reklamuese e lirë"]').count();
  check("landing shows an ad slot", adRegions >= 1, `${adRegions} slots`);

  const waLinks = page.locator('a[href^="https://wa.me/"]');
  const waCount = await waLinks.count();
  check("ad slots link to wa.me", waCount >= 1, `${waCount} links`);

  const href = await waLinks.first().getAttribute("href");
  check("link targets the configured number", href.includes("wa.me/38344123456"), href.slice(0, 60));
  check("link carries a prefilled message", href.includes("?text="));
  check(
    "message names the specific slot",
    decodeURIComponent(href).includes("Banderolë në ballinë"),
    decodeURIComponent(href).slice(0, 90)
  );

  const rel = await waLinks.first().getAttribute("rel");
  check("external ad link is rel-protected", (rel ?? "").includes("noopener"), rel ?? "(none)");
  check("opens in a new tab", (await waLinks.first().getAttribute("target")) === "_blank");

  check("footer advertise box present", (await page.locator("body").innerText()).includes("Reklamoni te ne"));
  check("footer shows formatted number", (await page.locator("body").innerText()).includes("+383 44 123 456"));
});

await step("ad slots appear across key pages", async () => {
  for (const [path, label] of [
    ["/explore", "explore"],
    ["/map", "map"],
  ]) {
    await go(path);
    await page.waitForTimeout(2000);
    const count = await page.locator('aside[aria-label^="Hapësirë reklamuese"]').count();
    check(`${label} page has an ad slot`, count >= 1, `${count} slots`);
  }

  // Report detail sidebar.
  await go("/explore");
  await page.waitForSelector('a[href^="/reports/"]:not([href="/reports/new"])', { timeout: 15000 });
  const href = await page
    .locator('a[href^="/reports/"]:not([href="/reports/new"])')
    .first()
    .getAttribute("href");
  await go(href);
  await page.waitForTimeout(2000);
  check(
    "report page has a sidebar ad slot",
    (await page.locator('aside[aria-label^="Hapësirë reklamuese"]').count()) >= 1
  );
});

await step("ads are accessible and non-intrusive", async () => {
  await go("/");
  await page.waitForTimeout(1200);
  // Ad regions must be labelled landmarks so screen readers can skip them.
  const labelled = await page.locator("aside[aria-label]").count();
  check("ad regions are labelled landmarks", labelled >= 1, `${labelled}`);
  check("still exactly one h1", (await page.locator("h1").count()) === 1);

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const m = await mobile.newPage();
  await m.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(1500);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  const cw = await m.evaluate(() => document.documentElement.clientWidth);
  check("ads cause no mobile overflow", sw <= cw + 1, `${sw} vs ${cw}`);
  await mobile.close();
});

await browser.close();
console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
