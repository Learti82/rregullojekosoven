import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/constants";
import { moderationDigestEmail, sendEmail } from "@/lib/email";

/**
 * Twice-daily reminder that citizen reports are waiting for a decision.
 *
 *   GET /api/cron/moderation-digest      (Vercel Cron — see vercel.json)
 *
 * Nothing a citizen submits is public until an administrator approves it, so an
 * unattended queue is not a cosmetic problem: it is the platform silently
 * swallowing reports. This mails every administrator a summary and a link
 * straight into the queue.
 *
 * The route is safe to call at any cadence. It refuses to send twice inside
 * MIN_HOURS_BETWEEN_SENDS, so a manual trigger, a retry, or a platform that
 * fires the schedule more often than configured cannot turn into a stream of
 * duplicate mail. That also means the 12-hour rhythm is enforced here rather
 * than depending on the scheduler being exact.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Twice a day, with an hour of slack so a slightly early tick still counts. */
const MIN_HOURS_BETWEEN_SENDS = 11;
/** Titles listed in the mail before it just gives a count. */
const SAMPLE_SIZE = 5;

const DIGEST_ACTION = "moderation.digest_sent";

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
          : "CRON_SECRET is not set — the digest is disabled.",
      },
      { status: 401 }
    );
  }

  try {
    const pending = await prisma.report.count({
      where: { moderationStatus: "PENDING_REVIEW" },
    });

    // An empty queue is the good case: say nothing rather than mailing a zero.
    if (pending === 0) {
      return NextResponse.json({ status: "ok", pending: 0, sent: 0, skipped: "queue_empty" });
    }

    const lastSend = await prisma.activityLog.findFirst({
      where: {
        action: DIGEST_ACTION,
        createdAt: { gte: new Date(Date.now() - MIN_HOURS_BETWEEN_SENDS * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (lastSend) {
      return NextResponse.json({
        status: "ok",
        pending,
        sent: 0,
        skipped: "sent_recently",
        lastSentAt: lastSend.createdAt.toISOString(),
      });
    }

    const [admins, samples] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, role: { name: "ADMIN" } },
        select: { id: true, email: true },
      }),
      prisma.report.findMany({
        where: { moderationStatus: "PENDING_REVIEW" },
        select: {
          title: true,
          createdAt: true,
          municipality: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: SAMPLE_SIZE,
      }),
    ]);

    const recipients = admins.filter((admin) => Boolean(admin.email));
    if (recipients.length === 0) {
      console.warn("[cron/moderation-digest] no active administrator has an email address");
      return NextResponse.json({ status: "ok", pending, sent: 0, skipped: "no_recipients" });
    }

    const message = moderationDigestEmail({
      pending,
      url: `${APP_URL}/admin/moderation`,
      samples: samples.map((report) => ({
        title: report.title,
        municipality: report.municipality.name,
        createdAt: report.createdAt,
      })),
    });

    const results = await Promise.all(
      recipients.map(async (admin) => {
        const result = await sendEmail({ to: admin.email!, ...message });
        if (!result.ok) console.error("[cron/moderation-digest]", admin.email, result.error);
        return result.ok;
      })
    );
    const sent = results.filter(Boolean).length;

    // Record the send only if at least one message got through, so a total
    // failure does not suppress the next attempt for eleven hours.
    if (sent > 0) {
      await prisma.activityLog.create({
        data: {
          action: DIGEST_ACTION,
          entityType: "report",
          metadata: { pending, recipients: sent },
        },
      });
    }

    // Administrators also get an in-app notification, which survives a mail
    // provider outage and is what they see next time they open the site.
    await prisma.notification.createMany({
      data: recipients.map((admin) => ({
        userId: admin.id,
        type: "SYSTEM" as const,
        title:
          pending === 1 ? "1 raport pret miratim" : `${pending} raporte presin miratim`,
        body: "Raportet nuk janë publike derisa t'i miratoni.",
        url: "/admin/moderation",
      })),
    });

    console.log("[cron/moderation-digest]", JSON.stringify({ pending, sent }));

    return NextResponse.json({
      status: "ok",
      pending,
      sent,
      recipients: recipients.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/moderation-digest]", error);
    return NextResponse.json(
      { status: "failed", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
