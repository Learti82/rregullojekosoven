import { describe, expect, it, vi, beforeEach } from "vitest";

// `getClientIp` reads Next's request headers, which do not exist under vitest.
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "203.0.113.9"]]) as never,
}));

const { rateLimit, enforceRateLimit, RateLimitError, hashIdentifier } = await import(
  "@/lib/rate-limit"
);

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit then blocks", async () => {
    const subject = `user-${Math.random()}`;
    // `comment` allows 20 per 10 minutes.
    for (let i = 0; i < 20; i++) {
      const result = await rateLimit("comment", subject);
      expect(result.success, `request ${i + 1} should pass`).toBe(true);
    }
    const blocked = await rateLimit("comment", subject);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("tracks subjects independently", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit("register", a);

    const blockedA = await rateLimit("register", a);
    expect(blockedA.success).toBe(false);

    const freshB = await rateLimit("register", b);
    expect(freshB.success).toBe(true);
  });

  it("throws RateLimitError with an Albanian message once over budget", async () => {
    const subject = `throw-${Math.random()}`;
    for (let i = 0; i < 5; i++) await enforceRateLimit("register", subject);
    await expect(enforceRateLimit("register", subject)).rejects.toBeInstanceOf(RateLimitError);
    await expect(enforceRateLimit("register", subject)).rejects.toThrow(/Shumë kërkesa/);
  });
});

describe("hashIdentifier", () => {
  it("is deterministic and never returns the raw value", () => {
    const ip = "203.0.113.9";
    const hashed = hashIdentifier(ip);
    expect(hashed).toBe(hashIdentifier(ip));
    expect(hashed).not.toContain(ip);
    expect(hashed).toHaveLength(32);
  });

  it("separates different identifiers", () => {
    expect(hashIdentifier("1.1.1.1")).not.toBe(hashIdentifier("2.2.2.2"));
  });
});

describe("login limiting is keyed per account, not just per IP", () => {
  it("does not lock out a second account from the same IP", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;

    // Exhaust the per-(ip, email) budget for one account.
    for (let i = 0; i < 8; i++) {
      const r = await rateLimit("login", `${ip}:victim@example.com`);
      expect(r.success).toBe(true);
    }
    expect((await rateLimit("login", `${ip}:victim@example.com`)).success).toBe(false);

    // A colleague behind the same NAT must still be able to sign in.
    expect((await rateLimit("login", `${ip}:colleague@example.com`)).success).toBe(true);
  });

  it("still caps total attempts per IP to stop credential spraying", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 50}`;
    for (let i = 0; i < 50; i++) {
      expect((await rateLimit("loginIp", ip)).success).toBe(true);
    }
    expect((await rateLimit("loginIp", ip)).success).toBe(false);
  });
});
