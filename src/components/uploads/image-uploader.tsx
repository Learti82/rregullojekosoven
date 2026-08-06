"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, Camera, ImagePlus, RotateCcw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES_PER_REPORT } from "@/lib/constants";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { ReportImageInput } from "@/validations/report";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/**
 * Reusable multi-image uploader.
 *
 * Files are compressed in a worker, uploaded straight to object storage through
 * a pre-signed URL, and only the resulting metadata is handed back via
 * `onChange` — the Server Action never carries binary data.
 */
export function ImageUploader({
  onChange,
  prefix = "reports",
  max = MAX_IMAGES_PER_REPORT,
  label = "Foto të problemit",
  hint,
  className,
}: {
  onChange: (images: ReportImageInput[]) => void;
  prefix?: "reports" | "progress" | "avatars";
  max?: number;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const { items, addFiles, remove, retry, isUploading, uploaded } = useImageUpload({ prefix });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  // Publish the completed set upward whenever it changes.
  const serialised = JSON.stringify(uploaded);
  React.useEffect(() => {
    onChange(uploaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised]);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const rejection = addFiles(files);
    if (rejection) toast.error(rejection);
  };

  const remaining = max - items.length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}/{max}
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-input bg-muted/30",
          remaining <= 0 && "opacity-60"
        )}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-background shadow-subtle">
          <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
        </div>

        <p className="mt-3 text-sm font-medium">
          Tërhiqni fotot këtu ose zgjidhni nga pajisja
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hint ?? `JPG, PNG ose WEBP · deri në 10MB për foto · maksimumi ${max} foto`}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={remaining <= 0}
          >
            <Upload /> Zgjidh foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cameraRef.current?.click()}
            disabled={remaining <= 0}
            className="sm:hidden"
          >
            <Camera /> Bëj foto
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          aria-label="Zgjidh foto për ngarkim"
        />
        {/* `capture` opens the rear camera directly on mobile. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          aria-label="Bëj foto me kamerë"
        />
      </div>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="group relative overflow-hidden rounded-lg border bg-card"
            >
              <div className="relative aspect-square bg-muted">
                <Image
                  src={item.previewUrl}
                  alt=""
                  fill
                  sizes="200px"
                  className={cn(
                    "object-cover transition-opacity",
                    item.status !== "done" && "opacity-60"
                  )}
                  unoptimized
                />

                {item.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/10 p-2 text-center">
                    <AlertCircle className="size-5 text-destructive" aria-hidden />
                    <p className="text-[11px] leading-tight text-destructive">{item.error}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => retry(item.id)}>
                      <RotateCcw /> Provo sërish
                    </Button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-slate-950/70 p-1.5 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Hiq foton ${item.file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="space-y-1 p-2">
                {item.status !== "done" && item.status !== "error" ? (
                  <>
                    <Progress value={item.progress} className="h-1" />
                    <p className="text-[11px] text-muted-foreground">
                      {item.status === "compressing" ? "Duke optimizuar…" : `Duke ngarkuar ${item.progress}%`}
                    </p>
                  </>
                ) : (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatBytes(item.uploaded?.sizeBytes ?? item.file.size)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isUploading ? (
        <p className="text-xs text-muted-foreground" role="status">
          Fotot po ngarkohen — prisni derisa të përfundojnë para se ta publikoni raportin.
        </p>
      ) : null}
    </div>
  );
}
