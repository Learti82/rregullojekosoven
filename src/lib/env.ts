/**
 * Runtime environment checks.
 *
 * These are deliberately *not* run at module load: the app must still build
 * without a database (see `/register`'s `force-dynamic` note), and a throw at
 * import time would break the build instead of the request.
 *
 * Instead, the checks run on first use and raise a message that names the
 * missing variable, so a misconfigured deployment says what is wrong rather
 * than surfacing a bare stack trace behind the generic error page.
 */

export type EnvStatus = {
  key: string;
  present: boolean;
  required: boolean;
  description: string;
};

const REQUIRED = [
  {
    key: "DATABASE_URL",
    description: "PostgreSQL connection string (use the pooled one on serverless).",
  },
  {
    key: "AUTH_SECRET",
    description: "Signing secret for sessions. Generate with: openssl rand -base64 32",
  },
  {
    // Sign-in is passwordless, so email is not a nice-to-have: without a
    // provider no one can log in at all, and a deployment in that state is
    // misconfigured even though every page renders.
    key: "RESEND_API_KEY",
    description:
      "Resend API key. Sign-in emails a one-time code — without this nobody can log in.",
  },
] as const;

const OPTIONAL = [
  {
    key: "DIRECT_DATABASE_URL",
    description: "Unpooled connection, used by prisma migrate. Falls back to DATABASE_URL.",
  },
  { key: "NEXT_PUBLIC_APP_URL", description: "Public origin, used for canonical/OG URLs." },
  {
    key: "EMAIL_FROM",
    description:
      "Sender for sign-in codes, e.g. 'RregulloKosovën <njoftime@yourdomain.org>'. Must be a domain verified in Resend.",
  },
  {
    key: "CRON_SECRET",
    description:
      "Guards the scheduled jobs (cleanup, moderation digest). Unset means neither runs.",
  },
  { key: "R2_ACCOUNT_ID", description: "Cloudflare R2 — enables photo upload." },
  { key: "R2_ACCESS_KEY_ID", description: "Cloudflare R2 — enables photo upload." },
  { key: "R2_SECRET_ACCESS_KEY", description: "Cloudflare R2 — enables photo upload." },
  { key: "R2_BUCKET_NAME", description: "Cloudflare R2 — enables photo upload." },
  { key: "R2_PUBLIC_URL", description: "Cloudflare R2 — public base URL of the bucket." },
  { key: "NEXT_PUBLIC_ADS_WHATSAPP", description: "WhatsApp number for advertising enquiries." },
] as const;

const isSet = (key: string) => Boolean(process.env[key]?.trim());

/** Non-throwing snapshot for the health endpoint. Never returns values. */
export function getEnvStatus(): EnvStatus[] {
  return [
    ...REQUIRED.map((entry) => ({ ...entry, required: true, present: isSet(entry.key) })),
    ...OPTIONAL.map((entry) => ({ ...entry, required: false, present: isSet(entry.key) })),
  ];
}

export function missingRequiredEnv(): string[] {
  return REQUIRED.filter((entry) => !isSet(entry.key)).map((entry) => entry.key);
}

/**
 * Throw a message an operator can act on. Called from the Prisma singleton so
 * the first query on a misconfigured deployment explains itself.
 */
export function assertDatabaseConfigured(): void {
  if (isSet("DATABASE_URL")) return;
  throw new Error(
    "DATABASE_URL is not set. Add it to the deployment's environment variables " +
      "(Vercel: Settings -> Environment Variables), then redeploy. " +
      "See DEPLOYMENT.md for the Neon setup."
  );
}
