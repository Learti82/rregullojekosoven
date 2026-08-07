import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Direct database access for the end-to-end harness.
 *
 * Used for the two things a browser genuinely cannot do: read back a sign-in
 * code that only ever exists in an email, and plant a submission whose whole
 * point is that it is not yet visible anywhere.
 *
 * ---------------------------------------------------------------------------
 * Test-side issuing of a sign-in code.
 *
 * The app never reveals a code over HTTP and the stored value is hashed, so an
 * end-to-end run cannot read one back. Rather than adding a bypass to the
 * application — a permanent hole in the login path, present in production, to
 * serve a test — the harness writes a row the same way `issueLoginCode` does and
 * then types the code into the real form. Everything under test stays real: the
 * server still recomputes the hash, enforces the expiry, the attempt cap and
 * single use.
 *
 * Mirrors src/lib/login-code.ts — if the hashing there changes, this must follow.
 */

const prisma = new PrismaClient();

function hashCode(email, code) {
  const pepper = process.env.AUTH_SECRET ?? "rregullo-kosoven";
  return createHash("sha256").update(`${pepper}:${email.toLowerCase()}:${code}`).digest("hex");
}

/** Plants a fresh code for `email` and returns its plaintext. */
export async function plantLoginCode(email, code = "424242") {
  const normalised = email.toLowerCase();
  await prisma.$transaction([
    prisma.loginCode.updateMany({
      where: { email: normalised, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.loginCode.create({
      data: {
        email: normalised,
        codeHash: hashCode(normalised, code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    }),
  ]);
  return code;
}

/**
 * Files a report as an ordinary citizen would, leaving it in PENDING_REVIEW.
 *
 * Written straight to the database rather than through the composer UI: the
 * composer needs geolocation permission and an object-storage upload, neither of
 * which this check is about. What is under test is the publication gate, and the
 * row it produces is identical either way.
 */
export async function createPendingReport(title) {
  const [author, municipality, category] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: { name: "CITIZEN" } } }),
    prisma.municipality.findFirstOrThrow(),
    prisma.category.findFirstOrThrow(),
  ]);

  const suffix = Date.now().toString(36);
  const report = await prisma.report.create({
    data: {
      title,
      description:
        "Raport i krijuar nga verifikimi automatik për të provuar radhën e miratimit.",
      slug: `verifikim-moderimi-${suffix}`,
      reference: `RK-E2E-${suffix}`,
      categoryId: category.id,
      municipalityId: municipality.id,
      latitude: municipality.latitude,
      longitude: municipality.longitude,
      createdById: author.id,
    },
    select: { slug: true, moderationStatus: true },
  });

  if (report.moderationStatus !== "PENDING_REVIEW") {
    throw new Error(
      `expected a new report to default to PENDING_REVIEW, got ${report.moderationStatus}`
    );
  }
  return report.slug;
}

export async function closeLoginCodeClient() {
  await prisma.$disconnect();
}
