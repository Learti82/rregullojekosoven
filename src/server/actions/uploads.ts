"use server";

import { requireUser } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createPresignedUpload, isStorageConfigured, type PresignedUpload } from "@/lib/storage";
import { presignSchema } from "@/validations/report";
import { ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

/**
 * Mint a short-lived, single-object upload URL.
 *
 * Only authenticated users get one; the content type and size are validated
 * server-side, and the object key is generated here so the client can never
 * choose where the file lands.
 */
export async function createUploadUrlAction(input: {
  contentType: string;
  size: number;
  prefix?: "reports" | "progress" | "avatars";
}): Promise<ActionResult<PresignedUpload>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("upload", user.id);

    if (!isStorageConfigured) {
      return {
        success: false,
        error:
          "Ngarkimi i imazheve nuk është aktiv në këtë mjedis. Konfiguroni R2 sipas udhëzuesit të vendosjes.",
      };
    }

    const parsed = parseInput(presignSchema, {
      contentType: input.contentType,
      size: input.size,
      prefix: input.prefix ?? "reports",
    });
    if (!parsed.ok) return parsed.result;

    const upload = await createPresignedUpload({
      prefix: parsed.data.prefix,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
    });

    return ok(upload);
  } catch (error) {
    return toActionError(error);
  }
}
