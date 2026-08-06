import { NextResponse } from "next/server";
import { getEnvStatus, missingRequiredEnv } from "@/lib/env";

/**
 * Deployment health check.
 *
 *   GET /api/health
 *
 * Reports which environment variables are configured and whether the database
 * answers, so a misconfigured deployment can be diagnosed from the browser
 * instead of from the platform's log viewer.
 *
 * It reports only presence — never a value — so it is safe to leave public.
 * Returns 503 when something required is missing, which also makes it usable as
 * an uptime probe.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const env = getEnvStatus();
  const missing = missingRequiredEnv();

  let database: { connected: boolean; error?: string; municipalities?: number } = {
    connected: false,
  };

  if (missing.includes("DATABASE_URL")) {
    database.error = "DATABASE_URL is not set.";
  } else {
    try {
      // Imported lazily so a missing DATABASE_URL cannot throw before we have
      // assembled the diagnostic response.
      const { prisma } = await import("@/lib/prisma");
      const count = await prisma.municipality.count();
      database = { connected: true, municipalities: count };
    } catch (error) {
      database = {
        connected: false,
        // Prisma error messages name the cause (auth failed, host unreachable,
        // relation missing) without containing the connection string.
        error: error instanceof Error ? error.message.split("\n")[0] : "Unknown error",
      };
    }
  }

  const seeded = database.connected && (database.municipalities ?? 0) > 0;
  const healthy = missing.length === 0 && database.connected && seeded;

  const hints: string[] = [];
  if (missing.length > 0) {
    hints.push(
      `Set ${missing.join(" and ")} in your hosting provider's environment variables, then redeploy.`
    );
  }
  if (database.connected && !seeded) {
    hints.push(
      "Database reachable but empty — run `npx prisma migrate deploy` then `npm run db:seed`."
    );
  }
  if (!database.connected && !missing.includes("DATABASE_URL")) {
    hints.push(
      "DATABASE_URL is set but the database did not answer. Check the value, and that migrations have been applied."
    );
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "misconfigured",
      database,
      env: env.map(({ key, present, required, description }) => ({
        key,
        present,
        required,
        ...(present ? {} : { description }),
      })),
      hints,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
