"use client";

import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES_PER_REPORT, MAX_IMAGE_SIZE_BYTES } from "@/lib/constants";
import { createUploadUrlAction } from "@/server/actions/uploads";
import type { ReportImageInput } from "@/validations/report";

export type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  error?: string;
  uploaded?: ReportImageInput;
};

const MAX_DIMENSION = 1920;
const COMPRESSION_TARGET_MB = 1.5;

/** Read intrinsic dimensions so they can be stored alongside the object. */
function readDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    image.src = url;
  });
}

/** PUT to the pre-signed URL with real progress events (fetch has none). */
function putWithProgress(
  url: string,
  file: Blob,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Ngarkimi dështoi (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Lidhja me serverin dështoi."));
    xhr.ontimeout = () => reject(new Error("Ngarkimi skadoi."));
    xhr.timeout = 120_000;
    xhr.send(file);
  });
}

export function useImageUpload(options?: { prefix?: "reports" | "progress" | "avatars" }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const prefix = options?.prefix ?? "reports";

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return "Formati nuk mbështetet. Lejohen JPG, PNG dhe WEBP.";
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) return "Skedari e kalon kufirin prej 10MB.";
    return null;
  }, []);

  const upload = useCallback(
    async (item: UploadItem) => {
      try {
        // Compress before asking for a URL: the signed URL pins Content-Length,
        // so the size must be final before signing.
        update(item.id, { status: "compressing", progress: 5 });
        const compressed = await imageCompression(item.file, {
          maxSizeMB: COMPRESSION_TARGET_MB,
          maxWidthOrHeight: MAX_DIMENSION,
          useWebWorker: true,
          fileType: item.file.type,
          initialQuality: 0.82,
        });

        const dimensions = await readDimensions(compressed);

        update(item.id, { status: "uploading", progress: 10 });
        const signed = await createUploadUrlAction({
          contentType: compressed.type,
          size: compressed.size,
          prefix,
        });
        if (!signed.success) {
          update(item.id, { status: "error", error: signed.error, progress: 0 });
          return;
        }

        await putWithProgress(signed.data.uploadUrl, compressed, (percent) =>
          update(item.id, { progress: Math.max(10, percent) })
        );

        update(item.id, {
          status: "done",
          progress: 100,
          uploaded: {
            url: signed.data.publicUrl,
            key: signed.data.key,
            sizeBytes: compressed.size,
            mimeType: compressed.type as ReportImageInput["mimeType"],
            width: dimensions?.width,
            height: dimensions?.height,
            caption: "",
          },
        });
      } catch (error) {
        update(item.id, {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Ngarkimi dështoi.",
        });
      }
    },
    [prefix, update]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      let rejected: string | null = null;

      setItems((current) => {
        const room = MAX_IMAGES_PER_REPORT - current.length;
        if (room <= 0) {
          rejected = `Maksimumi ${MAX_IMAGES_PER_REPORT} imazhe për raport.`;
          return current;
        }

        const accepted: UploadItem[] = [];
        for (const file of incoming.slice(0, room)) {
          const error = validate(file);
          if (error) {
            rejected = error;
            continue;
          }
          accepted.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            status: "pending",
          });
        }

        // Kick off uploads outside the state updater.
        queueMicrotask(() => accepted.forEach(upload));
        return [...current, ...accepted];
      });

      return rejected;
    },
    [upload, validate]
  );

  const remove = useCallback((id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      const target = items.find((item) => item.id === id);
      if (target) void upload({ ...target, status: "pending", progress: 0 });
    },
    [items, upload]
  );

  const setCaption = useCallback((id: string, caption: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.uploaded
          ? { ...item, uploaded: { ...item.uploaded, caption } }
          : item
      )
    );
  }, []);

  const reset = useCallback(() => {
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  }, []);

  return {
    items,
    addFiles,
    remove,
    retry,
    setCaption,
    reset,
    isUploading: items.some((item) => item.status === "compressing" || item.status === "uploading"),
    uploaded: items
      .filter((item) => item.status === "done" && item.uploaded)
      .map((item) => item.uploaded!),
  };
}
