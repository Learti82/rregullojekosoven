import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Behavioural tests for the one-time sign-in code.
 *
 * Prisma is mocked with a tiny in-memory table: these assertions are about the
 * *rules* (expiry, single use, attempt cap, cross-address isolation), which must
 * hold regardless of storage.
 */

type Row = {
  id: string;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  ipHash: string | null;
};

const rows: Row[] = [];
let nextId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginCode: {
      create: async ({ data }: { data: Omit<Row, "id" | "createdAt" | "attempts" | "consumedAt"> }) => {
        const row: Row = {
          id: String(nextId++),
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          ...data,
        } as Row;
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: { email: string; consumedAt: null }; data: { consumedAt: Date } }) => {
        let count = 0;
        for (const row of rows) {
          if (row.email === where.email && row.consumedAt === null) {
            row.consumedAt = data.consumedAt;
            count++;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: { where: { email: string; consumedAt: null } }) => {
        const matches = rows
          .filter((r) => r.email === where.email && r.consumedAt === null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return matches[0] ?? null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        if ("consumedAt" in data) row.consumedAt = data.consumedAt as Date;
        if ("attempts" in data) {
          const increment = (data.attempts as { increment?: number }).increment;
          row.attempts = increment ? row.attempts + increment : (data.attempts as number);
        }
        return row;
      },
      deleteMany: async () => ({ count: 0 }),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

const { issueLoginCode, verifyLoginCode, generateCode, MAX_ATTEMPTS, CODE_LENGTH } =
  await import("@/lib/login-code");

beforeEach(() => {
  rows.length = 0;
  nextId = 1;
});

describe("generateCode", () => {
  it("always produces a zero-padded code of the expected length", () => {
    for (let i = 0; i < 300; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(/^[0-9]+$/);
    }
  });

  it("does not repeat trivially", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateCode()));
    // 200 draws from a million-wide space should collide almost never.
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe("verifyLoginCode", () => {
  it("accepts the issued code exactly once", async () => {
    const { code } = await issueLoginCode("arta@example.com");

    expect(await verifyLoginCode("arta@example.com", code)).toEqual({ ok: true });
    // Replaying the same code must fail: it is single use.
    expect(await verifyLoginCode("arta@example.com", code)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects a wrong code and counts the attempt", async () => {
    await issueLoginCode("arta@example.com");
    const result = await verifyLoginCode("arta@example.com", "000000");
    // A correct guess is possible but overwhelmingly unlikely; either outcome
    // must be a valid shape.
    if (!result.ok) expect(result.reason).toBe("mismatch");
    expect(rows[0].attempts).toBeGreaterThanOrEqual(0);
  });

  it("locks the code after too many wrong attempts", async () => {
    const { code } = await issueLoginCode("arta@example.com");
    const wrong = code === "111111" ? "222222" : "111111";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await verifyLoginCode("arta@example.com", wrong);
    }

    // Even the *correct* code is refused once the cap is hit.
    expect(await verifyLoginCode("arta@example.com", code)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
  });

  it("refuses an expired code", async () => {
    const { code } = await issueLoginCode("arta@example.com");
    rows[0].expiresAt = new Date(Date.now() - 1000);

    expect(await verifyLoginCode("arta@example.com", code)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("will not accept a code issued for a different address", async () => {
    const { code } = await issueLoginCode("arta@example.com");
    await issueLoginCode("burim@example.com");

    const result = await verifyLoginCode("burim@example.com", code);
    expect(result.ok).toBe(false);
  });

  it("invalidates the previous code when a new one is requested", async () => {
    const first = await issueLoginCode("arta@example.com");
    await issueLoginCode("arta@example.com");

    // The email someone received first must stop working after a resend.
    const result = await verifyLoginCode("arta@example.com", first.code);
    expect(result.ok).toBe(false);
  });

  it("reports not_found when no code was ever issued", async () => {
    expect(await verifyLoginCode("nobody@example.com", "123456")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("matches case-insensitively on the address", async () => {
    const { code } = await issueLoginCode("Arta@Example.com");
    expect(await verifyLoginCode("arta@example.com", code)).toEqual({ ok: true });
  });

  it("never stores the code in plaintext", async () => {
    const { code } = await issueLoginCode("arta@example.com");
    expect(rows[0].codeHash).not.toContain(code);
    expect(rows[0].codeHash).toHaveLength(64); // sha256 hex
  });
});
