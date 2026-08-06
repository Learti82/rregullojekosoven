"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import type { NotificationItem } from "@/types";
import {
  clearReadNotificationsAction,
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const ICONS: Record<NotificationType, typeof Bell> = {
  REPORT_STATUS_CHANGED: RefreshCw,
  REPORT_COMMENTED: MessageSquare,
  COMMENT_REPLIED: MessageSquare,
  REPORT_COMPLETED: CheckCircle2,
  REPORT_VOTED: ThumbsUp,
  BADGE_EARNED: Award,
  ASSIGNMENT_CREATED: ClipboardList,
  SYSTEM: Bell,
};

export function NotificationList({
  notifications,
  hasUnread,
}: {
  notifications: NotificationItem[];
  hasUnread: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = (
    fn: () => Promise<{ success: boolean; message?: string; error?: string }>
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        toast.error(result.error ?? "Veprimi dështoi.");
        return;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {hasUnread ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(markAllNotificationsReadAction)}
          >
            <CheckCheck /> Shëno të gjitha si të lexuara
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(clearReadNotificationsAction)}
        >
          <Trash2 /> Pastro të lexuarat
        </Button>
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {notifications.map((notification) => {
          const Icon = ICONS[notification.type] ?? Bell;
          const unread = !notification.readAt;

          const content = (
            <div className="flex items-start gap-3">
              {notification.actor ? (
                <Avatar className="size-9 shrink-0">
                  {notification.actor.image ? (
                    <AvatarImage src={notification.actor.image} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(notification.actor.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="size-4 text-primary" aria-hidden />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", unread && "font-semibold")}>
                  {notification.title}
                </p>
                {notification.body ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
                <time
                  dateTime={new Date(notification.createdAt).toISOString()}
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  {formatRelativeTime(notification.createdAt)}
                </time>
              </div>

              {unread ? (
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                  aria-label="E palexuar"
                />
              ) : null}
            </div>
          );

          return (
            <li
              key={notification.id}
              className={cn("group relative transition-colors", unread && "bg-primary/[0.03]")}
            >
              {notification.url ? (
                <Link
                  href={notification.url}
                  className="block p-4 hover:bg-accent/40"
                  onClick={() => {
                    if (unread) void markNotificationReadAction(notification.id);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <div className="p-4">{content}</div>
              )}

              <button
                type="button"
                onClick={() => run(() => deleteNotificationAction(notification.id))}
                disabled={pending}
                className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                aria-label="Fshij njoftimin"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
