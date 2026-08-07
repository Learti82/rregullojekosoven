import "server-only";
import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * One-time email sign-in codes.
 *
 * Design notes, all of which matter for a login primitive:
 *
 * - The code is 6 digits, so it must be defended in depth: short expiry, a hard
 *   attempt cap, single use, and rate limiting at the action layer.
 * - Only a SHA-256 hash is stored. A 6-digit space is trivially brute-forced
 *   offline, so the hash is not a secrecy guarantee — it exists so that a leaked
 *   database dump cannot be *replayed* directly, and so codes never appear in
 *   logs or backups as plaintext.
 * - `randomInt` is cryptographically secure; `Math.random` would be predictable.
 * - Requesting a new code invalidates earlier ones for that address, so an old
 *   email cannot be used after a resend.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  // randomInt is uniform over the range — no modulo bias.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function hashCode(email: string, code: string): string {
  const pepper = process.env.AUTH_SECRET ?? "rregullo-kosoven";
  // The email is part of the input so a code issued for one address cannot be
  // presented for another.
  return createHash("sha256").update(`${pepper}:${email.toLowerCase()}:${code}`).digest("hex");
}

export type IssuedCode = { code: string; expiresAt: Date };

/** Invalidate any outstanding codes for the address and issue a fresh one. */
export async function issueLoginCode(email: string, ipHash?: string): Promise<IssuedCode> {
  const normalised = email.toLowerCase();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.loginCode.updateMany({
      where: { email: normalised, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.loginCode.create({
      data: {
        email: normalised,
        codeHash: hashCode(normalised, code),
        expiresAt,
        ipHash: ipHash ?? null,
      },
    }),
  ]);

  return { code, expiresAt };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Check a submitted code and consume it on success.
 *
 * A wrong code increments `attempts` on the *stored* row, so guessing is capped
 * per issued code rather than per request.
 */
export async function verifyLoginCode(email: string, code: string): Promise<VerifyOutcome> {
  const normalised = email.toLowerCase();

  const record = await prisma.loginCode.findFirst({
    where: { email: normalised, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "not_found" };

  if (record.expiresAt < new Date()) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (record.codeHash !== hashCode(normalised, code.trim())) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "mismatch" };
  }

  await prisma.loginCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}

/** Housekeeping: drop spent and expired rows. */
export async function purgeExpiredCodes(): Promise<number> {
  const result = await prisma.loginCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { consumedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}
