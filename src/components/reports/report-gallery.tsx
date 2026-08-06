"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import type { ReportImage } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Report image gallery with a lightbox.
 * Arrow keys navigate while the lightbox is open; Escape closes it (Radix).
 */
export function ReportGallery({
  images,
  title,
}: {
  images: Pick<ReportImage, "id" | "url" | "thumbnailUrl" | "caption" | "width" | "height">[];
  title: string;
}) {
  const [active, setActive] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const go = React.useCallback(
    (direction: 1 | -1) => {
      setActive((current) => (current + direction + images.length) % images.length);
    },
    [images.length]
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (images.length === 0) return null;
  const current = images[active]!;

  return (
    <section aria-label={`Galeria: ${title}`} className="space-y-3">
      <div className="group relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted">
        <Image
          src={current.url}
          alt={current.caption ?? `${title} — foto ${active + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 720px"
          className="object-cover"
          priority
        />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-3 top-3 rounded-full bg-slate-950/60 p-2 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Zmadho foton"
        >
          <Expand className="size-4" />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/60 p-2 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Foto e mëparshme"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/60 p-2 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Foto tjetër"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
              {active + 1}/{images.length}
            </span>
          </>
        ) : null}
      </div>

      {current.caption ? (
        <p className="text-sm text-muted-foreground">{current.caption}</p>
      ) : null}

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={index === active}
                aria-label={`Shfaq foton ${index + 1}`}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                  index === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <Image
                  src={image.thumbnailUrl ?? image.url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{current.caption ?? title}</DialogTitle>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-950">
            <Image
              src={current.url}
              alt={current.caption ?? title}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
