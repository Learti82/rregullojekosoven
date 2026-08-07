import "server-only";
import { APP_NAME } from "@/lib/constants";

/**
 * Transactional email via Resend.
 *
 * Called through the REST API rather than the SDK — one fetch, no dependency,
 * and nothing to keep in sync.
 *
 * When `RESEND_API_KEY` is absent the app does not pretend to have sent
 * anything: in development the message is printed to the server console so
 * sign-in remains testable, and in production the caller receives a failure so
 * the UI can say the code could not be sent rather than leaving someone waiting
 * for an email that will never arrive.
 *
 * `EMAIL_TRANSPORT=console` forces the printing behaviour regardless of
 * NODE_ENV. That exists for automated end-to-end runs, which execute a
 * production build with no mail provider; it has to be set deliberately, so a
 * real deployment that simply forgot its API key still fails loudly rather than
 * silently logging every sign-in code.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM =
  process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;

const CONSOLE_TRANSPORT =
  process.env.EMAIL_TRANSPORT === "console" || process.env.NODE_ENV !== "production";

export const isEmailConfigured = Boolean(RESEND_API_KEY);

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    if (!CONSOLE_TRANSPORT) {
      return {
        ok: false,
        error: "Dërgimi i email-it nuk është konfiguruar. Kontaktoni administratorin.",
      };
    }
    // Print instead of sending, so sign-in stays usable without a provider.
    console.log(
      `\n──────── EMAIL (not sent — RESEND_API_KEY unset) ────────\n` +
        `To:      ${params.to}\nSubject: ${params.subject}\n\n${params.text}\n` +
        `────────────────────────────────────────────────────────\n`
    );
    return { ok: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] Resend rejected the message:", response.status, detail);
      return { ok: false, error: "Email-i nuk mund të dërgohej. Provoni sërish." };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email]", error);
    return { ok: false, error: "Email-i nuk mund të dërgohej. Provoni sërish." };
  }
}

/** Shared shell so every message looks like it comes from the same product. */
function layout(heading: string, body: string): string {
  return `<!doctype html><html lang="sq"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <tr><td style="background:linear-gradient(135deg,#1E4FD8,#0F2A80);padding:20px 28px">
        <span style="color:#fff;font-size:17px;font-weight:600;letter-spacing:-.3px">${APP_NAME}</span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a">${heading}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
        Ky email u dërgua nga ${APP_NAME}, platforma qytetare për raportimin e problemeve publike në Kosovë.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function loginCodeEmail(code: string, minutes: number) {
  const spaced = code.split("").join(" ");
  return {
    subject: `${code} — kodi juaj i kyçjes në ${APP_NAME}`,
    text:
      `Kodi juaj i kyçjes është: ${code}\n\n` +
      `Kodi skadon pas ${minutes} minutash dhe mund të përdoret vetëm një herë.\n\n` +
      `Nëse nuk e keni kërkuar ju këtë kod, injorojeni këtë email — askush nuk mund të hyjë në llogarinë tuaj pa të.`,
    html: layout(
      "Kodi juaj i kyçjes",
      `<p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.6">
         Përdorni këtë kod për të hyrë në llogarinë tuaj:
       </p>
       <div style="margin:0 0 18px;padding:16px;border-radius:10px;background:#f1f5f9;text-align:center">
         <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#1E4FD8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${spaced}</span>
       </div>
       <p style="margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.6">
         Kodi skadon pas <strong>${minutes} minutash</strong> dhe mund të përdoret vetëm një herë.
       </p>
       <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6">
         Nëse nuk e keni kërkuar ju këtë kod, injorojeni këtë email. Askush nuk mund të hyjë në llogarinë tuaj pa të.
       </p>`
    ),
  };
}

export function moderationDigestEmail(params: {
  pending: number;
  url: string;
  samples: { title: string; municipality: string; createdAt: Date }[];
}) {
  const rows = params.samples
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
           <div style="color:#0f172a;font-size:14px;font-weight:500">${escapeHtml(item.title)}</div>
           <div style="color:#64748b;font-size:12px;margin-top:2px">${escapeHtml(item.municipality)}</div>
         </td></tr>`
    )
    .join("");

  return {
    subject:
      params.pending === 1
        ? `1 raport pret miratim — ${APP_NAME}`
        : `${params.pending} raporte presin miratim — ${APP_NAME}`,
    text:
      `${params.pending} raporte presin miratimin tuaj.\n\n` +
      params.samples.map((s) => `• ${s.title} (${s.municipality})`).join("\n") +
      `\n\nShqyrtoni këtu: ${params.url}`,
    html: layout(
      params.pending === 1 ? "1 raport pret miratim" : `${params.pending} raporte presin miratim`,
      `<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6">
         Qytetarët kanë dërguar raporte të reja. Ato nuk shfaqen publikisht derisa t'i miratoni.
       </p>
       <table role="presentation" width="100%" style="margin:0 0 20px">${rows}</table>
       <a href="${params.url}" style="display:inline-block;background:#1E4FD8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:600">
         Shqyrto raportet
       </a>`
    ),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
