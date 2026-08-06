import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Scheduled housekeeping.
 *
 *   GET /api/cron/cleanup      (Vercel Cron, daily — see vercel.json)
 *
 * Two tables grow with *activity* rather than with content, so left alone they
 * eventually dominate storage even though they carry no lasting value:
 *
 *   activity_logs   one row per sign-in, vote, status change, moderation action
 *   notifications   one row per recipient per event
 *
 * Reports, comments and votes are never touched — they are the public record and
 * the whole point of the platform.
 *
 * Retention is deliberately generous: long enough to investigate an incident or
 * a dispute months later, short enough that the tables stay bounded.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Audit trail: keep a year — enough to answer "who changed this, and when". */
const ACTIVITY_LOG_DAYS = 365;
/** Read notifications: keep 90 days. Unread ones are never deleted. */
const READ_NOTIFICATION_DAYS = 90;
/** Expired auth sessions serve no purpose once past their expiry. */
const SESSION_GRACE_DAYS = 7;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Vercel signs cron invocations with CRON_SECRET. Without that check anyone who
 * found the URL could trigger deletions, so an unset secret disables the
 * endpoint rather than leaving it open.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: process.env.CRON_SECRET
          ? "Unauthorized."
          : "CRON_SECRET is not set — cleanup is disabled.",
      },
      { status: 401 }
    );
  }

  try {
    const [activityLogs, notifications, sessions] = await Promise.all([
      prisma.activityLog.deleteMany({
        where: { createdAt: { lt: daysAgo(ACTIVITY_LOG_DAYS) } },
      }),
      prisma.notification.deleteMany({
        where: {
          readAt: { not: null, lt: daysAgo(READ_NOTIFICATION_DAYS) },
        },
      }),
      prisma.session.deleteMany({
        where: { expires: { lt: daysAgo(SESSION_GRACE_DAYS) } },
      }),
    ]);

    const deleted = {
      activityLogs: activityLogs.count,
      readNotifications: notifications.count,
      expiredSessions: sessions.count,
    };

    console.log("[cron/cleanup]", JSON.stringify(deleted));

    return NextResponse.json({
      status: "ok",
      deleted,
      retention: {
        activityLogDays: ACTIVITY_LOG_DAYS,
        readNotificationDays: READ_NOTIFICATION_DAYS,
        sessionGraceDays: SESSION_GRACE_DAYS,
      },
      note: "Reports, comments and votes are never deleted.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/cleanup]", error);
    return NextResponse.json(
      { status: "failed", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
