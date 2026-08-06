import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client per Node process.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * pool on every edit and exhaust the database's connection limit. In production
 * (including Vercel's serverless runtime) each lambda instance keeps one client
 * for the lifetime of the container.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
