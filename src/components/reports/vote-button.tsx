"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCompact } from "@/lib/utils";
import { voteAction } from "@/server/actions/reports";

type VoteButtonProps = {
  reportId: string;
  score: number;
  viewerVote: "UPVOTE" | "DOWNVOTE" | null;
  isAuthenticated: boolean;
  orientation?: "vertical" | "horizontal";
  className?: string;
};

/**
 * Optimistic voting.
 *
 * The local state flips immediately and is reconciled with the server's
 * authoritative counters when the action resolves; on failure it rolls back to
 * the snapshot taken before the click.
 */
export function VoteButton({
  reportId,
  score,
  viewerVote,
  isAuthenticated,
  orientation = "vertical",
  className,
}: VoteButtonProps) {
  const router = useRouter();
  const [state, setState] = React.useState({ score, viewerVote });
  const [pending, startTransition] = React.useTransition();

  // Keep in sync when the server sends fresh props after a revalidation.
  React.useEffect(() => setState({ score, viewerVote }), [score, viewerVote]);

  const cast = (type: "UPVOTE" | "DOWNVOTE") => {
    if (!isAuthenticated) {
      toast.error("Kyçuni për të votuar.", {
        action: { label: "Kyçu", onClick: () => router.push("/login") },
      });
      return;
    }

    const previous = state;
    const isSame = state.viewerVote === type;
    const delta = type === "UPVOTE" ? 1 : -1;
    // Switching sides moves the score by two, casting/retracting by one.
    const scoreDelta = isSame ? -delta : state.viewerVote ? delta * 2 : delta;

    setState({ score: state.score + scoreDelta, viewerVote: isSame ? null : type });

    startTransition(async () => {
      const result = await voteAction({ reportId, type });
      if (!result.success) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      setState({
        score: result.data.score,
        viewerVote: result.data.viewerVote as "UPVOTE" | "DOWNVOTE" | null,
      });
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-full border bg-card p-0.5",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
    >
      <button
        type="button"
        onClick={() => cast("UPVOTE")}
        disabled={pending}
        aria-pressed={state.viewerVote === "UPVOTE"}
        aria-label="Voto pro"
        className={cn(
          "rounded-full p-1.5 transition-colors hover:bg-success/10 disabled:opacity-60",
          state.viewerVote === "UPVOTE" ? "text-success" : "text-muted-foreground"
        )}
      >
        <ArrowBigUp
          className={cn("size-5", state.viewerVote === "UPVOTE" && "fill-current")}
          aria-hidden
        />
      </button>

      <span
        className="min-w-[2ch] text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
      >
        {formatCompact(state.score)}
      </span>

      <button
        type="button"
        onClick={() => cast("DOWNVOTE")}
        disabled={pending}
        aria-pressed={state.viewerVote === "DOWNVOTE"}
        aria-label="Voto kundër"
        className={cn(
          "rounded-full p-1.5 transition-colors hover:bg-destructive/10 disabled:opacity-60",
          state.viewerVote === "DOWNVOTE" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <ArrowBigDown
          className={cn("size-5", state.viewerVote === "DOWNVOTE" && "fill-current")}
          aria-hidden
        />
      </button>
    </div>
  );
}
