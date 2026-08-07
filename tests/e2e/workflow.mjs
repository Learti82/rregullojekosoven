import { chromium } from "@playwright/test";
import { closeLoginCodeClient, plantLoginCode } from "./db.mjs";
const BASE = process.env.E2E_BASE ?? "http://localhost:3300";
const out = [];
let fail = 0;
const check = (n, ok, d = "") => { out.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); if (!ok) fail++; };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const go = (path) => p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });

// Sign in as the Prishtina municipal admin. Sign-in is passwordless, so the
// harness plants the one-time code it would otherwise have received by email.
const STAFF_EMAIL = "admin@prishtina.shembull.com";
await plantLoginCode(STAFF_EMAIL);
await go("/login");
await p.fill("#email", STAFF_EMAIL);
await p.click('button[type="submit"]');
await p.waitForSelector("#code", { timeout: 25000 });
// The request replaced the planted row; plant the same code again and submit it.
const staffCode = await plantLoginCode(STAFF_EMAIL);
await p.fill("#code", staffCode);
await p.click('form:has(#code) button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// Find a PENDING report in this municipality.
await go("/municipality/reports?status=PENDING");
await p.waitForTimeout(2000);
const link = p.locator('a[href^="/reports/"]:not([href="/reports/new"])').first();
const count = await link.count();
check("pending queue has a report to work", count > 0);
if (count === 0) { console.log(out.join("\n")); process.exit(1); }

const href = await link.getAttribute("href");
await go(href);
await p.waitForTimeout(2000);
check("management panel present", (await p.locator("body").innerText()).includes("Paneli i menaxhimit"));

// The status dropdown must only offer legal transitions from PENDING.
await p.locator('#status').click();
await p.waitForTimeout(800);
const options = await p.locator('[role="option"]').allInnerTexts();
check("offers legal transitions from Pending", options.includes("I verifikuar"), options.join("|"));
check("does NOT offer illegal jump to Completed", !options.includes("I zgjidhur"), options.join("|"));

// Apply: Pending -> Verified.
await p.locator('[role="option"]:has-text("I verifikuar")').click();
await p.waitForTimeout(500);
await p.fill("#note", "Verifikuar nga ekipi i terrenit gjatë inspektimit.");
await p.locator('button[type="submit"]:has-text("Përditëso statusin")').click();
await p.waitForTimeout(4000);

const afterText = await p.locator("body").innerText();
check("status advanced to Verified", afterText.includes("I verifikuar"));
check("public note recorded in timeline", afterText.includes("Verifikuar nga ekipi i terrenit"));

// The timeline should now show the transition authored by the staff account.
check("timeline shows the change author", afterText.includes("Vjosa"));

// Next legal step from Verified must now include Assigned / In progress.
await p.locator('#status').click();
await p.waitForTimeout(800);
const next = await p.locator('[role="option"]').allInnerTexts();
check("transition set updates after change", next.includes("Në proces") || next.includes("I caktuar"), next.join("|"));

await browser.close();
await closeLoginCodeClient();
console.log(out.join("\n"));
console.log(`\n${out.length - fail}/${out.length} workflow checks passed`);
process.exit(fail ? 1 : 0);
