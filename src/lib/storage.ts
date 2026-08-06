import { randomUUID } from "crypto";
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/constants";

/**
 * Object storage on Cloudflare R2 (S3-compatible, free tier).
 *
 * The browser never receives long-lived credentials: it asks the server for a
 * short-lived pre-signed PUT URL and uploads straight to R2. That keeps large
 * binaries out of Server Actions entirely and off the Vercel function budget.
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

export const isStorageConfigured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL
);

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isStorageConfigured) {
    throw new StorageError(
      "Ruajtja e imazheve nuk është e konfiguruar. Shtoni variablat R2_* në mjedis."
    );
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export type PresignedUpload = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Validate a client-declared file before any credential is minted.
 * The MIME allow-list is re-checked here rather than trusted from the form,
 * and the key is server-generated so a caller cannot write outside its prefix.
 */
export function validateUploadRequest(input: {
  contentType: string;
  size: number;
}): asserts input is { contentType: (typeof ACCEPTED_IMAGE_TYPES)[number]; size: number } {
  if (!ACCEPTED_IMAGE_TYPES.includes(input.contentType as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new StorageError("Formati i skedarit nuk lejohet. Përdorni JPG, PNG ose WEBP.");
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new StorageError("Madhësia e skedarit është e pavlefshme.");
  }
  if (input.size > MAX_IMAGE_SIZE_BYTES) {
    throw new StorageError("Skedari e kalon kufirin prej 10MB.");
  }
}

export function buildObjectKey(prefix: string, contentType: string): string {
  const ext = EXTENSION_BY_TYPE[contentType] ?? "bin";
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}/${datePath}/${randomUUID()}.${ext}`;
}

export async function createPresignedUpload(params: {
  prefix: string;
  contentType: string;
  size: number;
  expiresIn?: number;
}): Promise<PresignedUpload> {
  validateUploadRequest({ contentType: params.contentType, size: params.size });

  const key = buildObjectKey(params.prefix, params.contentType);
  const expiresIn = params.expiresIn ?? 60 * 5;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET!,
    Key: key,
    ContentType: params.contentType,
    // Bound the upload server-side too: a signed URL alone would otherwise
    // accept a body of any size.
    ContentLength: params.size,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });

  return {
    uploadUrl,
    key,
    publicUrl: buildPublicUrl(key),
    expiresIn,
  };
}

export function buildPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!isStorageConfigured || keys.length === 0) return;
  // The S3 API caps batch deletes at 1000 keys.
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await getClient().send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET!,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
  }
}

/** Guards against a client posting a URL that does not belong to our bucket. */
export function isOwnedStorageUrl(url: string): boolean {
  if (!R2_PUBLIC_URL) return false;
  try {
    return new URL(url).origin === new URL(R2_PUBLIC_URL).origin;
  } catch {
    return false;
  }
}
