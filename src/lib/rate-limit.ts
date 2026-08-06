import { createHash } from "crypto";
import { headers } from "next/headers";

/**
 * Sliding-window rate limiter.
 *
 * The default store is in-process: on a single server it is exact, and on
 * serverless it bounds abuse per warm instance. It is deliberately behind an
 * interface so a shared store (Redis, or a Postgres table) can be dropped in
 * without touching call sites — see `setRateLimitStore`.
 */

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window frees up. */
  resetAt: number;
};

export interface RateLimitStore {
  hit(key: string, windowMs: number, limit: number): Promise<RateLimitResult>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    const timestamps = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    const success = timestamps.length < limit;
    if (success) timestamps.push(now);
    this.buckets.set(key, timestamps);

    const oldest = timestamps[0] ?? now;
    return {
      success,
      limit,
      remaining: Math.max(0, limit - timestamps.length),
      resetAt: oldest + windowMs,
    };
  }

  /** Drop empty buckets periodically so the map cannot grow unbounded. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    const cutoff = now - 60 * 60 * 1000;
    for (const [key, times] of this.buckets) {
      const kept = times.filter((t) => t > cutoff);
      if (kept.length === 0) this.buckets.delete(key);
      else this.buckets.set(key, kept);
    }
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export const RATE_LIMITS = {
  /**
   * Login is limited on two axes, because either one alone misbehaves:
   *
   * - `login` is keyed on (ip + email) and stops a brute-force run against a
   *   single account.
   * - `loginIp` is keyed on the IP alone, with a much higher budget, and stops
   *   one host from spraying many accounts.
   *
   * Keying only on IP would be actively harmful here: shared NAT is the norm
   * for Kosovo households and municipal offices, so a single colleague fat-
   * fingering their password would lock out the whole building.
   */
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  loginIp: { limit: 50, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  createReport: { limit: 10, windowMs: 60 * 60 * 1000 },
  comment: { limit: 20, windowMs: 10 * 60 * 1000 },
  vote: { limit: 60, windowMs: 10 * 60 * 1000 },
  upload: { limit: 40, windowMs: 60 * 60 * 1000 },
  statusChange: { limit: 120, windowMs: 60 * 60 * 1000 },
  search: { limit: 120, windowMs: 60 * 1000 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/** Hashed so raw IPs are never persisted or held in memory. */
export function hashIdentifier(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.AUTH_SECRET ?? "rregullo-kosoven";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? headerList.get("cf-connecting-ip") ?? "unknown";
}

/**
 * @param action  which limit bucket to consume from
 * @param subject stable per-caller identifier (user id when signed in, else IP)
 */
export async function rateLimit(
  action: RateLimitAction,
  subject?: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const identity = subject ?? (await getClientIp());
  return store.hit(`${action}:${hashIdentifier(identity)}`, windowMs, limit);
}

export class RateLimitError extends Error {
  constructor(public resetAt: number) {
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    const wait =
      seconds < 60 ? `${seconds} sekonda` : `${Math.ceil(seconds / 60)} minuta`;
    super(`Shumë kërkesa. Provoni sërish pas ${wait}.`);
    this.name = "RateLimitError";
  }
}

/** Throws `RateLimitError` when the caller is over budget. */
export async function enforceRateLimit(action: RateLimitAction, subject?: string) {
  const result = await rateLimit(action, subject);
  if (!result.success) throw new RateLimitError(result.resetAt);
  return result;
}
