"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Uses the Web Share sheet on devices that have one (most phones), and falls
 * back to a copy-link menu everywhere else.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);

  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Linku u kopjua.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopjimi dështoi. Kopjojeni linkun manualisht.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      // The user dismissing the sheet throws AbortError — not worth reporting.
      if ((error as Error)?.name !== "AbortError") await copy();
    }
  };

  if (canShare) {
    return (
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 /> Ndaj
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 /> Ndaj
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={copy}>
          {copied ? <Check /> : <Link2 />} Kopjo linkun
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Ndaj në Facebook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Ndaj në X
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
