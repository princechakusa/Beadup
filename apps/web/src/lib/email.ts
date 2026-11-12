import "server-only";
import { z } from "zod";
import { formatMoney, formatPhone, formatWhen, whatsappUrl, type Country } from "./countries";
import { SITE_URL } from "./seo";
import { supabaseAdmin } from "./supabase-admin";
import { tierLabel } from "./trades";

/**
 * Client emails through Brevo's transactional API (free tier). Queued in the
 * database (client_emails, one per event), sent right after the event and by
 * the 15-minute cron. Without BREVO_API_KEY they are marked "skipped".
 */
const ctxSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["confirmation", "reminder", "rescheduled", "cancelled", "receipt"]),
  status: z.string(),
  to: z.email(),
  firstName: z.string(),
  businessName: z.string(),
  handle: z.string(),
  contactPhone: z.string().nullable(),
  country: z.enum(["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"]),
  timezone: z.string(),
  trade: z.string(),
  visitMode: z.string(),
  serviceArea: z.string(),
  paymentLink: z.string().nullable(),
  paymentNote: z.string().nullable(),
  payments: z.string(),
  serviceName: z.string(),
  vehicleSize: z.enum(["sedan", "suv", "truck"]),
  startsAt: z.string(),
  durationMin: z.number(),
  address: z.string(),
  subtotalCents: z.number(),
  depositCents: z.number(),
  depositReceived: z.boolean(),
  clientToken: z.string(),
  reviewToken: z.string(),
  ref: z.string(),
});
type Ctx = z.infer<typeof ctxSchema>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Subject, plain text and HTML for one email. Exported for tests. */
export function composeEmail(c: Ctx): { subject: string; text: string; html: string } {
  const money = (n: number) => formatMoney(n, c.country as Country);
  const when = formatWhen(c.startsAt, c.timezone, c.country as Country);
  const page = `${SITE_URL}/b/${c.clientToken}`;
  const size = tierLabel(c.trade, c.vehicleSize);
  const what = [c.serviceName, size].filter(Boolean).join(" · ");
  const where = c.visitMode === "studio" ? [c.businessName, c.serviceArea].filter(Boolean).join(", ") : c.address;
  const depositDue = c.payments === "external" && c.depositCents > 0 && !c.depositReceived;

  const top: Record<Ctx["kind"], [string, string]> = {
    confirmation: [`You're booked with ${c.businessName}`, `Hi ${c.firstName}, your booking is confirmed.`],
    reminder: [`Reminder: ${c.serviceName} tomorrow`, `Hi ${c.firstName}, see you tomorrow.`],
    rescheduled: [`New time for your ${c.serviceName}`, `Hi ${c.firstName}, ${c.businessName} moved your booking.`],
    cancelled: [`Your booking with ${c.businessName} is cancelled`, `Hi ${c.firstName}, this booking has been cancelled. If you paid a deposit, ${c.businessName} will sort it out with you directly.`],
    receipt: [`Your receipt from ${c.businessName}`, `Hi ${c.firstName}, thanks for choosing ${c.businessName}. Your receipt is ready, with a 30-second rating if you'd like to leave one.`],
  };
  const [subject, intro] = top[c.kind];
  const rows: [string, string][] =
    c.kind === "receipt"
      ? [["Service", what], ["Total", money(c.subtotalCents)], ["Ref", c.ref]]
      : [["When", when], ["Service", what], ["Where", where], ["Total", money(c.subtotalCents)], ["Ref", c.ref]];
  if (depositDue && c.kind !== "cancelled" && c.kind !== "receipt") rows.splice(4, 0, ["Deposit due", money(c.depositCents)]);
  const cta: [string, string] | null =
    c.kind === "receipt" ? ["See receipt and rate", `${SITE_URL}/r/${c.reviewToken}`] : c.kind === "cancelled" ? [`Book ${c.businessName} again`, `${SITE_URL}/${c.handle}`] : ["Your booking page", page];
  const contact = c.contactPhone
    ? `Questions? ${c.businessName}: ${formatPhone(c.contactPhone, c.country as Country)}`
    : `Questions? Reply on your booking page.`;
  const payLine = depositDue && c.kind === "confirmation" ? `Pay your ${money(c.depositCents)} deposit to ${c.businessName}${c.paymentNote ? `: ${c.paymentNote}` : ""}${c.paymentLink ? ` ${c.paymentLink}` : ""}` : "";

  const text = [intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), payLine && `\n${payLine}`, cta && `\n${cta[0]}: ${cta[1]}`, `\n${contact}`, "\nSent by Beadup for " + c.businessName + ". You get this email because you booked with them."]
    .filter((x) => x !== "")
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#0A0C10;font-family:Inter,Arial,sans-serif;color:#F4F6FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161A21;border:1px solid #262B35;border-radius:24px;padding:28px">
<tr><td style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4DD8FF;padding-bottom:8px">${esc(c.businessName)}</td></tr>
<tr><td style="font-size:24px;font-weight:800;line-height:1.2;padding-bottom:12px">${esc(subject)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#C9D0DC;padding-bottom:18px">${esc(intro)}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #262B35">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;color:#9AA3B2;font-size:14px">${esc(k)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:600;${k === "Total" || k === "Deposit due" ? "color:#FFB547" : ""}">${esc(v)}</td></tr>`).join("")}
</table></td></tr>
${payLine ? `<tr><td style="padding-top:14px;font-size:14px;line-height:1.6;color:#F4F6FA">${esc(payLine)}</td></tr>` : ""}
${cta ? `<tr><td style="padding-top:22px"><a href="${esc(cta[1])}" style="display:inline-block;background:#4DD8FF;color:#04121A;font-weight:700;text-decoration:none;border-radius:16px;padding:14px 22px">${esc(cta[0])}</a></td></tr>` : ""}
${c.contactPhone ? `<tr><td style="padding-top:18px;font-size:14px;color:#9AA3B2">${esc(contact)} · <a href="${esc(whatsappUrl(c.contactPhone, `Hi ${c.businessName}, it's ${c.firstName} (ref ${c.ref}).`))}" style="color:#7ff0a8">WhatsApp</a></td></tr>` : ""}
</table>
<p style="max-width:520px;font-size:12px;color:#6b7383;line-height:1.5;margin:16px auto 0">Sent by Beadup for ${esc(c.businessName)}. You get this email because you booked with them.</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

async function send(c: Ctx): Promise<{ ok: true } | { ok: false; error: string; skip?: boolean }> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: "BREVO_API_KEY not set", skip: true };
  const m = composeEmail(c);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: `${c.businessName.slice(0, 60)} via Beadup`, email: process.env.EMAIL_FROM ?? "support@beadup.app" },
      to: [{ email: c.to }],
      subject: m.subject,
      textContent: m.text,
      htmlContent: m.html,
      tags: [c.kind],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? { ok: true } : { ok: false, error: `brevo ${res.status}` };
}

/** Sends queued client emails (up to 50). Safe to call often: each email goes once. */
export async function deliverEmails(): Promise<{ sent: number; skipped: number; failed: number }> {
  const db = supabaseAdmin();
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!db) return out;
  const { data: ids } = await db.rpc("queued_emails", { p_limit: 50 });
  for (const id of (ids as string[] | null) ?? []) {
    const { data } = await db.rpc("email_context", { p_email_id: id });
    const ctx = ctxSchema.safeParse(data);
    if (!ctx.success || ctx.data.status !== "queued") {
      await db.rpc("mark_email", { p_email_id: id, p_status: "failed", p_error: "bad context" });
      out.failed++;
      continue;
    }
    const r = await send(ctx.data).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "error" }));
    if (r.ok) {
      await db.rpc("mark_email", { p_email_id: id, p_status: "sent" });
      out.sent++;
    } else if ("skip" in r && r.skip) {
      await db.rpc("mark_email", { p_email_id: id, p_status: "skipped", p_error: r.error });
      out.skipped++;
    } else {
      // Left queued for the next run (up to 5 attempts in total).
      await db.rpc("mark_email", { p_email_id: id, p_status: "queued", p_error: r.error });
      out.failed++;
    }
  }
  return out;
}
