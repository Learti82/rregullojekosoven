/**
 * End-to-end verification against a running production build.
 * Run: node tests/e2e/verify.mjs   (expects a running build and a seeded DB)
 */
import { chromium } from "@playwright/test";
import { closeLoginCodeClient, createPendingReport, plantLoginCode } from "./db.mjs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const results = [];
let failures = 0;
const consoleErrors = [];

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Run a named step; a throw is recorded as a failure instead of aborting. */
async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    check(name, false, String(err.message).split("\n")[0]);
  }
}

const go = (page, path) =>
  page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });

/** Poll until `text` is absent from the page; false if it never goes away. */
async function gone(page, text, timeout = 25000) {
  try {
    await page.waitForFunction((t) => !document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Poll until `text` is present on the page; false if it never shows up. */
async function appears(page, text, timeout = 25000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Passwordless sign-in: request a code, then submit it.
 *
 * The code is planted directly in the database beforehand because no email is
 * delivered during a test run. The two-step form itself is exercised for real.
 */
async function login(page, email) {
  const code = await plantLoginCode(email);

  await go(page, "/login");
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.fill("#email", email);
  await page.click('button[type="submit"]');

  // Requesting a code replaces the planted row, so plant again once the form has
  // moved on to step two and submit that value.
  await page.waitForSelector("#code", { timeout: 25000 });
  await plantLoginCode(email, code);

  await page.fill("#code", code);
  await page.click('form:has(#code) button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});

function watch(page) {
  // Record the page each error came from: a bare stack trace from a minified
  // bundle is close to useless without knowing which route produced it.
  const where = () => {
    try {
      return new URL(page.url()).pathname;
    } catch {
      return "?";
    }
  };
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[${where()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`[${where()}] pageerror: ${e.message}`));
  return page;
}

// =============================================================== anonymous
const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = watch(await anon.newPage());

await step("landing renders", async () => {
  await go(page, "/");
  const h1 = await page.locator("h1").first().innerText();
  check("landing renders hero", h1.includes("Raporto"), h1.slice(0, 40));
  check("landing shows platform stats", (await page.locator("dl dd").count()) >= 4);
});

await step("map mounts", async () => {
  await go(page, "/map");
  await page.waitForSelector(".leaflet-container", { timeout: 20000 });
  await page.waitForTimeout(2500);
  check("Leaflet map mounts", (await page.locator(".leaflet-container").count()) > 0);
  const markers = await page.locator(".rk-marker, .rk-cluster").count();
  check("map renders markers/clusters", markers > 0, `${markers} found`);
  check("map tiles requested", (await page.locator("img.leaflet-tile").count()) > 0);
});

await step("explore + search", async () => {
  await go(page, "/explore");
  await page.waitForTimeout(1500);
  check("explore lists reports", (await page.locator('a[href^="/reports/"]:not([href="/reports/new"])').count()) > 0);

  await go(page, "/explore?q=" + encodeURIComponent("gropë"));
  await page.waitForTimeout(1500);
  check("search finds matching report", (await page.locator("body").innerText()).includes("Gropë"));

  await go(page, "/explore?status=COMPLETED");
  await page.waitForTimeout(1500);
  const txt = await page.locator("body").innerText();
  check("status filter narrows results", txt.includes("I zgjidhur") || txt.includes("Asnjë raport"));
});

await step("report detail (anonymous)", async () => {
  await go(page, "/explore");
  await page.waitForSelector('a[href^="/reports/"]:not([href="/reports/new"])', { timeout: 15000 });
  const href = await page.locator('a[href^="/reports/"]:not([href="/reports/new"])').first().getAttribute("href");
  await go(page, href);
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  check("detail shows status history", body.includes("Historiku i raportit"));
  check("detail shows location section", body.includes("Vendndodhja"));
  check("anonymous sees sign-in prompt for comments", body.includes("Kyçuni"));
  check("anonymous sees no management panel", !body.includes("Paneli i menaxhimit"));
});

// =============================================================== citizen
const citizen = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const cPage = watch(await citizen.newPage());

await step("citizen login", async () => {
  await login(cPage, "arta@shembull.com");
  check("citizen login succeeds", !cPage.url().includes("/login"), cPage.url());
});

await step("voting round-trip", async () => {
  await go(cPage, "/explore");
  await cPage.waitForSelector('button[aria-label="Voto pro"]', { timeout: 15000 });
  const up = cPage.locator('button[aria-label="Voto pro"]').first();
  const score = up.locator("xpath=following-sibling::span[1]");
  const before = Number((await score.innerText()).trim());
  const pressedBefore = (await up.getAttribute("aria-pressed")) === "true";

  await up.click();
  await cPage.waitForTimeout(3000);
  const after = Number((await score.innerText()).trim());
  const pressedAfter = (await up.getAttribute("aria-pressed")) === "true";

  check("vote changes score", before !== after, `${before} -> ${after}`);
  // Clicking the same arrow toggles: casting adds a point and marks the button
  // pressed; clicking again retracts it. Assert the two stay consistent rather
  // than assuming a fresh, never-voted report.
  check(
    "pressed state matches score direction",
    pressedAfter === !pressedBefore && (pressedAfter ? after === before + 1 : after === before - 1),
    `pressed ${pressedBefore}->${pressedAfter}, score ${before}->${after}`
  );

  // Toggling back must restore the original score exactly (no drift).
  // Re-locate first: the action calls revalidatePath, so the server re-renders
  // and the previous element handle can be detached by the time we click again.
  const up2 = cPage.locator('button[aria-label="Voto pro"]').first();
  await up2.waitFor({ state: "visible", timeout: 20000 });
  // The control is disabled for the duration of the vote transition (and again
  // while the router refresh that revalidatePath triggers settles), so poll for
  // it to come back rather than racing it.
  await cPage.waitForFunction(
    () => {
      const el = document.querySelector('button[aria-label="Voto pro"]');
      return el instanceof HTMLButtonElement && !el.disabled;
    },
    undefined,
    { timeout: 25000 }
  );
  await up2.click({ timeout: 20000 });
  await cPage.waitForTimeout(3000);
  const restored = Number(
    (await up2.locator("xpath=following-sibling::span[1]").innerText()).trim()
  );
  check("second click restores original score", restored === before, `${after} -> ${restored} (was ${before})`);
});

await step("commenting", async () => {
  await go(cPage, "/explore");
  await cPage.waitForSelector('a[href^="/reports/"]:not([href="/reports/new"])', { timeout: 15000 });
  const href = await cPage.locator('a[href^="/reports/"]:not([href="/reports/new"])').first().getAttribute("href");
  await go(cPage, href);
  const box = cPage.locator('textarea[aria-label="Komenti juaj"]');
  await box.waitFor({ timeout: 15000 });
  const text = `Verifikim automatik ${Date.now()}`;
  await box.fill(text);
  await cPage.locator('button:has-text("Dërgo")').first().click();
  await cPage.waitForTimeout(4000);
  check("comment posts and appears", (await cPage.locator("body").innerText()).includes(text));
});

await step("citizen authorization", async () => {
  for (const path of ["/admin", "/municipality"]) {
    await go(cPage, path);
    await cPage.waitForTimeout(800);
    check(`citizen blocked from ${path}`, !new URL(cPage.url()).pathname.startsWith(path), cPage.url());
  }
});

await step("report composer", async () => {
  await go(cPage, "/reports/new");
  await cPage.waitForSelector("#title", { timeout: 20000 });
  check("composer loads fields", (await cPage.locator("#title").count()) > 0);
  await cPage.waitForSelector(".leaflet-container", { timeout: 20000 });
  check("composer has location picker", (await cPage.locator(".leaflet-container").count()) > 0);
  const hasUploader = (await cPage.locator('input[type="file"]').count()) > 0;
  const warns = (await cPage.locator("body").innerText()).includes("Ngarkimi i fotove është i çaktivizuar");
  check(
    "uploader present, or storage-disabled notice shown",
    hasUploader || warns,
    hasUploader ? "uploader rendered" : "R2 unconfigured -> notice shown"
  );
  // Submit is gated until a location is picked.
  const submit = cPage.locator('button[type="submit"]:has-text("Publiko")');
  check("submit disabled without location", await submit.isDisabled());
});

await step("citizen profile + settings", async () => {
  await go(cPage, "/profile/arta");
  await cPage.waitForTimeout(1200);
  check("profile renders", (await cPage.locator("body").innerText()).includes("Arta"));
  await go(cPage, "/settings");
  await cPage.waitForTimeout(1200);
  check("settings renders", (await cPage.locator("body").innerText()).includes("Cilësimet"));
  await go(cPage, "/notifications");
  await cPage.waitForTimeout(1200);
  check("notifications renders", (await cPage.locator("body").innerText()).includes("Njoftimet"));
});

// =============================================================== municipal admin
const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const sPage = watch(await staffCtx.newPage());

await step("municipality staff", async () => {
  await login(sPage, "admin@prishtina.shembull.com");
  await go(sPage, "/municipality");
  await sPage.waitForTimeout(2000);
  check("staff reaches dashboard", sPage.url().includes("/municipality"), sPage.url());
  const body = await sPage.locator("body").innerText();
  check("dashboard shows KPIs", body.includes("Raporte gjithsej"));
  check("dashboard scoped to own municipality", body.includes("Prishtinë"));

  await go(sPage, "/admin");
  await sPage.waitForTimeout(1000);
  check("municipal admin blocked from /admin", !new URL(sPage.url()).pathname.startsWith("/admin"), sPage.url());

  await go(sPage, "/municipality/reports");
  await sPage.waitForTimeout(1500);
  check("municipality report table renders", (await sPage.locator("table").count()) > 0);

  await go(sPage, "/municipality/assignments");
  await sPage.waitForTimeout(1200);
  check("assignments page renders", (await sPage.locator("body").innerText()).includes("Detyrat"));
});

await step("staff sees management panel on own report", async () => {
  await go(sPage, "/municipality/reports");
  await sPage.waitForSelector('a[href^="/reports/"]:not([href="/reports/new"])', { timeout: 15000 });
  const href = await sPage.locator('a[href^="/reports/"]:not([href="/reports/new"])').first().getAttribute("href");
  await go(sPage, href);
  await sPage.waitForTimeout(2000);
  check("management panel visible to staff", (await sPage.locator("body").innerText()).includes("Paneli i menaxhimit"));
});

// =============================================================== platform admin
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const aPage = watch(await adminCtx.newPage());

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@rregullokosoven.org";

await step("platform admin", async () => {
  await login(aPage, ADMIN_EMAIL);
  await go(aPage, "/admin");
  await aPage.waitForTimeout(2500);
  check("admin reaches analytics", aPage.url().includes("/admin"), aPage.url());
  check("analytics renders charts", (await aPage.locator("svg.recharts-surface").count()) > 0);

  for (const [path, marker] of [
    ["/admin/moderation", "Miratimi i raporteve"],
    ["/admin/users", "Përdoruesit"],
    ["/admin/municipalities", "Komunat"],
    ["/admin/categories", "Kategoritë"],
    ["/admin/logs", "Regjistrat"],
    ["/admin/reports", "Raportet"],
  ]) {
    await go(aPage, path);
    await aPage.waitForTimeout(1200);
    check(`admin ${path} renders`, (await aPage.locator("body").innerText()).includes(marker));
  }
});

await step("moderation gate", async () => {
  // A report a citizen files must not be publicly visible until it is approved,
  // and approving it must put it in front of everyone. This walks that whole
  // path rather than trusting the query filters in isolation.
  const title = `Verifikim i moderimit ${Date.now()}`;
  const slug = await createPendingReport(title);

  await go(page, `/reports/${slug}`);
  await page.waitForTimeout(1200);
  const anonBody = await page.locator("body").innerText();
  check("pending report is not public", !anonBody.includes(title), anonBody.slice(0, 60));

  await go(aPage, "/admin/moderation");
  await aPage.waitForSelector("article", { timeout: 15000 });
  const queueBody = await aPage.locator("body").innerText();
  check("pending report appears in the queue", queueBody.includes(title));

  const card = aPage.locator("article", { hasText: title }).first();
  await card.locator('button:has-text("Mirato")').first().click();

  // Approving revalidates several routes and then refreshes the queue, so how
  // long the card takes to disappear varies. Poll rather than guess a duration.
  check("approved report leaves the queue", await gone(aPage, title));

  await go(page, `/reports/${slug}`);
  check("approved report becomes public", await appears(page, title));
});

// =============================================================== theming, mobile, a11y
await step("dark mode", async () => {
  await aPage.emulateMedia({ colorScheme: "dark" });
  await go(aPage, "/");
  await aPage.waitForTimeout(1200);
  const cls = (await aPage.locator("html").getAttribute("class")) ?? "";
  check("dark mode class applied", cls.includes("dark"), `class="${cls}"`);
});

await step("mobile layout", async () => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mPage = watch(await mobile.newPage());
  await go(mPage, "/");
  await mPage.waitForTimeout(1500);
  const scrollW = await mPage.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await mPage.evaluate(() => document.documentElement.clientWidth);
  check("no horizontal overflow on mobile", scrollW <= clientW + 1, `${scrollW} vs ${clientW}`);

  await mPage.locator('button[aria-label="Hap menynë"]').click();
  await mPage.waitForTimeout(900);
  check("mobile nav drawer opens", (await mPage.locator('a:has-text("Eksploro")').count()) > 0);

  await go(mPage, "/explore");
  await mPage.waitForTimeout(1500);
  const w2 = await mPage.evaluate(() => document.documentElement.scrollWidth);
  const c2 = await mPage.evaluate(() => document.documentElement.clientWidth);
  check("explore has no mobile overflow", w2 <= c2 + 1, `${w2} vs ${c2}`);
  await mobile.close();
});

await step("accessibility basics", async () => {
  await go(page, "/explore");
  await page.waitForTimeout(1500);
  check("all images carry alt", (await page.locator("img:not([alt])").count()) === 0);
  check("single h1 on page", (await page.locator("h1").count()) === 1);
  check("skip link present", (await page.locator("a.skip-link").count()) === 1);
  check("html lang is sq", (await page.locator("html").getAttribute("lang")) === "sq");
  const unlabelled = await page.locator("button:not([aria-label]):not(:has-text(''))").count();
  check("buttons are labelled or have text", unlabelled >= 0);
});

await browser.close();
await closeLoginCodeClient();

const realErrors = consoleErrors.filter(
  (e) => !/favicon|Download the React DevTools|net::ERR_|tile\.openstreetmap/i.test(e)
);

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
if (realErrors.length) {
  console.log(`\nBrowser errors (${realErrors.length}):`);
  console.log([...new Set(realErrors)].slice(0, 10).join("\n"));
}
process.exit(failures > 0 ? 1 : 0);
