"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageSquare, Reply, Send, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";
import type { CommentNode } from "@/types";
import type { SessionUser } from "@/lib/permissions";
import {
  createCommentAction,
  deleteCommentAction,
  toggleCommentLikeAction,
} from "@/server/actions/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_LENGTH = 2000;

function CommentForm({
  reportId,
  parentId,
  onDone,
  autoFocus,
  placeholder = "Shkruani një koment…",
}: {
  reportId: string;
  parentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (body.trim().length < 2) {
      toast.error("Komenti është shumë i shkurtër.");
      return;
    }

    const formData = new FormData();
    formData.set("reportId", reportId);
    formData.set("body", body);
    if (parentId) formData.set("parentId", parentId);

    startTransition(async () => {
      const result = await createCommentAction(null, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setBody("");
      toast.success(result.message ?? "Komenti u shtua.");
      onDone?.();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH))}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        aria-label={parentId ? "Përgjigja juaj" : "Komenti juaj"}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {body.length}/{MAX_LENGTH}
        </span>
        <div className="flex gap-2">
          {onDone ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Anulo
            </Button>
          ) : null}
          <Button type="submit" size="sm" loading={pending} disabled={body.trim().length < 2}>
            <Send /> Dërgo
          </Button>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  reportId,
  viewer,
  depth = 0,
}: {
  comment: CommentNode;
  reportId: string;
  viewer: SessionUser | null;
  depth?: number;
}) {
  const router = useRouter();
  const [replying, setReplying] = React.useState(false);
  const [like, setLike] = React.useState({
    liked: comment.likedByViewer,
    count: comment.likesCount,
  });
  const [pending, startTransition] = React.useTransition();

  const canDelete = viewer && (viewer.id === comment.userId || viewer.role === "ADMIN");

  const toggleLike = () => {
    if (!viewer) {
      toast.error("Kyçuni për të pëlqyer komentet.");
      return;
    }
    const previous = like;
    setLike({ liked: !like.liked, count: like.count + (like.liked ? -1 : 1) });
    startTransition(async () => {
      const result = await toggleCommentLikeAction(comment.id);
      if (!result.success) {
        setLike(previous);
        toast.error(result.error);
        return;
      }
      setLike({ liked: result.data.liked, count: result.data.likesCount });
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteCommentAction(comment.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Komenti u fshi.");
      router.refresh();
    });
  };

  if (comment.isDeleted && comment.replies.length === 0) return null;

  return (
    <li id={`comment-${comment.id}`} className={cn(depth > 0 && "ml-6 border-l pl-4 sm:ml-10")}>
      <article className="py-3">
        {comment.isDeleted ? (
          <p className="text-sm italic text-muted-foreground">Ky koment është fshirë.</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Avatar className="size-8 shrink-0">
                {comment.user.image ? <AvatarImage src={comment.user.image} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {initials(comment.user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link
                    href={`/profile/${comment.user.username}`}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {comment.user.name}
                  </Link>
                  {comment.isOfficial ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <ShieldCheck className="size-3" aria-hidden /> Zyrtare
                    </span>
                  ) : null}
                  <RelativeTime
                    date={comment.createdAt}
                    className="text-xs text-muted-foreground"
                  />
                </div>

                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {comment.body}
                </p>

                <div className="mt-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleLike}
                    disabled={pending}
                    aria-pressed={like.liked}
                    className={cn("h-7 px-2 text-xs", like.liked && "text-destructive")}
                  >
                    <Heart className={cn("size-3.5", like.liked && "fill-current")} />
                    <span className="tabular-nums">{like.count}</span>
                    <span className="sr-only">pëlqime</span>
                  </Button>

                  {depth === 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplying((value) => !value)}
                      className="h-7 px-2 text-xs"
                    >
                      <Reply className="size-3.5" /> Përgjigju
                    </Button>
                  ) : null}

                  {canDelete ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Fshij
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Të fshihet komenti?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ky veprim nuk mund të zhbëhet. Përgjigjet do të mbeten të dukshme.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Anulo</AlertDialogCancel>
                          <AlertDialogAction onClick={remove}>Fshij</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>

                {replying && viewer ? (
                  <div className="mt-3">
                    <CommentForm
                      reportId={reportId}
                      parentId={comment.id}
                      onDone={() => setReplying(false)}
                      autoFocus
                      placeholder={`Përgjigju ${comment.user.name}…`}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </article>

      {comment.replies.length > 0 ? (
        <ul>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              reportId={reportId}
              viewer={viewer}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentSection({
  reportId,
  comments,
  viewer,
}: {
  reportId: string;
  comments: CommentNode[];
  viewer: SessionUser | null;
}) {
  const total = comments.reduce(
    (sum, comment) => sum + 1 + comment.replies.length,
    0
  );

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h2 id="comments-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <MessageSquare className="size-5" aria-hidden />
        Komentet
        <span className="text-sm font-normal text-muted-foreground tabular-nums">({total})</span>
      </h2>

      {viewer ? (
        <CommentForm reportId={reportId} />
      ) : (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Kyçuni
          </Link>{" "}
          për të marrë pjesë në diskutim.
        </div>
      )}

      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Ende asnjë koment"
          description="Bëhuni i pari që shton informacion për këtë problem."
        />
      ) : (
        <ul className="divide-y">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              reportId={reportId}
              viewer={viewer}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
