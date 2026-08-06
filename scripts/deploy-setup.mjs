/**
 * Prepare the database during deployment.
 *
 *   node scripts/deploy-setup.mjs
 *
 * Runs as part of the build so a deployment is self-initialising: no connection
 * strings copied to a laptop, no migrate/seed commands run by hand. It:
 *
 *   1. falls back DIRECT_DATABASE_URL -> DATABASE_URL, so a host that provides
 *      only one URL (Vercel's Neon integration does) still works,
 *   2. applies pending migrations,
 *   3. seeds reference data — roles, all 38 municipalities, categories, badges —
 *      which the app cannot function without.
 *
 * It is safe to run on every deploy: migrations are tracked and skipped once
 * applied, and the seed upserts rather than duplicating.
 *
 * When DATABASE_URL is absent it prints what is missing and exits 0, leaving the
 * build to succeed. A first deploy therefore goes live and says what it needs
 * (see /api/health) rather than failing with a build error.
 *
 * Set SKIP_DB_SETUP=true to opt out — appropriate once you want migrations
 * applied deliberately rather than on every deploy.
 */
import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

// A plain Node process does not read .env — Next.js loads it for the app, and
// hosting platforms provide real environment variables. Loading it here makes
// `npm run db:setup` behave the same locally as it does during a deploy.
loadEnv({ quiet: true });

const line = "─".repeat(64);
const log = (message) => console.log(`[deploy-setup] ${message}`);

if (process.env.SKIP_DB_SETUP === "true") {
  log("SKIP_DB_SETUP=true — skipping migrations and seed.");
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.log(line);
  log("DATABASE_URL is not set — skipping database setup.");
  log("The build will still succeed, but the site cannot serve pages until");
  log("you add DATABASE_URL and AUTH_SECRET to the environment and redeploy.");
  log("Check /api/health on the deployed URL to see what is missing.");
  console.log(line);
  process.exit(0);
}

// Prisma Migrate needs a session-level connection. Hosts that expose only a
// single URL work fine here — the pooled URL handles migrations acceptably at
// this scale, and this keeps first-time setup to one variable.
if (!process.env.DIRECT_DATABASE_URL?.trim()) {
  process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
  log("DIRECT_DATABASE_URL not set — falling back to DATABASE_URL.");
}

function run(command, label) {
  log(label);
  execSync(command, { stdio: "inherit", env: process.env });
}

try {
  run("npx prisma migrate deploy", "Applying migrations…");
  // Reference data only. Demo reports still require SEED_DEMO=true explicitly,
  // so production never gets sample content by accident.
  run("npx tsx prisma/seed.ts", "Seeding reference data…");
  log("Database ready.");
} catch (error) {
  console.error(line);
  console.error("[deploy-setup] Database setup FAILED.");
  console.error("[deploy-setup] The most common causes:");
  console.error("[deploy-setup]   • DATABASE_URL points somewhere unreachable");
  console.error("[deploy-setup]   • the database is still waking up — redeploy to retry");
  console.error("[deploy-setup]   • credentials in the URL are wrong");
  console.error(line);
  // Fail the build: shipping an app whose schema was not applied would only
  // move the failure to every page request, which is harder to diagnose.
  process.exit(1);
}
