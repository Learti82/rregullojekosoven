import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/permissions";
import { RateLimitError, getClientIp, hashIdentifier } from "@/lib/rate-limit";
import { StorageError } from "@/lib/storage";
import type { ActionResult } from "@/types";

/**
 * Translate any thrown error into the `ActionResult` shape the UI consumes.
 *
 * Known error classes carry user-facing Albanian messages; anything else is
 * logged server-side and reported generically so internals never leak to the
 * client.
 */
export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: "Të dhënat e dërguara nuk janë të vlefshme.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (
    error instanceof AuthorizationError ||
    error instanceof RateLimitError ||
    error instanceof StorageError
  ) {
    return { success: false, error: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { success: false, error: "Ky rekord ekziston tashmë." };
    }
    if (error.code === "P2025") {
      return { success: false, error: "Rekordi nuk u gjet." };
    }
  }
  console.error("[action]", error);
  return { success: false, error: "Ndodhi një gabim i papritur. Provoni sërish." };
}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

/** Validate with Zod and surface field errors instead of throwing. */
export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Ju lutemi korrigjoni fushat e shënuara.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      },
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Append to the audit trail. Never throws — an unwritable log must not roll
 * back the user's action.
 */
export async function logActivity(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    const ip = await getClientIp();
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata,
        ipHash: ip === "unknown" ? null : hashIdentifier(ip),
      },
    });
  } catch (error) {
    console.error("[activity-log]", error);
  }
}

/** Sequential human-readable reference, e.g. RK-2026-000123. */
export async function nextReportReference(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.report.count({
    where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
  });
  return `RK-${year}-${String(count + 1).padStart(6, "0")}`;
}
