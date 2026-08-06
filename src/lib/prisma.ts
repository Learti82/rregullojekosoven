import { PrismaClient } from "@prisma/client";
import { assertDatabaseConfigured } from "@/lib/env";

/**
 * A single Prisma client per Node process, constructed lazily.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * pool on every edit and exhaust the database's connection limit. In production
 * (including Vercel's serverless runtime) each lambda instance keeps one client
 * for the lifetime of the container.
 *
 * Construction is deferred to the first property access rather than done at
 * import time. `next build` imports every module to collect page data, so an
 * eager client — and especially an eager configuration check — turns a missing
 * DATABASE_URL into a *build* failure. The app is meant to build without a
 * database and fail clearly at request time instead.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  // Raises a message naming the variable, instead of letting Prisma surface a
  // schema-validation trace from behind the generic error page.
  assertDatabaseConfigured();

  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

function getClient(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(getClient(), property, receiver);
    // Model delegates and $-methods must stay bound to the real client.
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
  has: (_target, property) => property in getClient(),
});

export default prisma;
