import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * Replaces the `prisma` key in package.json, which Prisma 6 deprecates and
 * Prisma 7 removes.
 *
 * Note: unlike the package.json key, a config file does not load `.env`
 * automatically, so the CLI would otherwise stop seeing DATABASE_URL during
 * local `prisma migrate` / `db:seed`. Loading it here keeps local workflows
 * working; in CI and on Vercel the variables come from the environment and
 * there is no `.env` to read.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
