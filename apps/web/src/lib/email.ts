import "server-only";
import { z } from "zod";
import { formatMoney, formatPhone, formatWhen, whatsappUrl, type Country } from "./countries";
import { SITE_URL } from "./seo";
import { supabaseAdmin } from "./supabase-admin";
import { DATE_LOCALE, isLocale, phrasesFor, type Locale } from "./i18n";
import { emailT } from "./i18n/email";
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
  staffName: z.string().nullable().default(null),
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
  lang: z.string().default("en"),
});
type Ctx = z.infer<typeof ctxSchema>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Subject, plain text and HTML for one email. Exported for tests. */
export function composeEmail(c: Ctx): { subject: string; text: string; html: string } {
  const lang: Locale = isLocale(c.lang) ? c.lang : "en";
  const t = emailT(lang);
  const phrases = phrasesFor(lang);
  const money = (n: number) => formatMoney(n, c.country as Country);
  const when = formatWhen(c.startsAt, c.timezone, c.country as Country, DATE_LOCALE[lang]);
  const page = `${SITE_URL}/b/${c.clientToken}`;
  const sizeEn = tierLabel(c.trade, c.vehicleSize);
  const size = sizeEn ? (phrases[sizeEn] ?? sizeEn) : "";
  const what = [c.serviceName, size].filter(Boolean).join(" · ");
  const where = c.visitMode === "studio" ? [c.businessName, c.serviceArea].filter(Boolean).join(", ") : c.address;
  const depositDue = c.payments === "external" && c.depositCents > 0 && !c.depositReceived;
  const vars = { business: c.businessName, name: c.firstName, service: c.serviceName };

  const top: Record<Ctx["kind"], [string, string]> = {
    confirmation: [t("subject_confirmation", vars), t("intro_confirmation", vars)],
    reminder: [t("subject_reminder", vars), t("intro_reminder", vars)],
    rescheduled: [t("subject_rescheduled", vars), t("intro_rescheduled", vars)],
    cancelled: [t("subject_cancelled", vars), t("intro_cancelled", vars)],
    receipt: [t("subject_receipt", vars), t("intro_receipt", vars)],
  };
  const [subject, intro] = top[c.kind];
  // Row ids stay stable (used for styling); labels are translated.
  type Row = [id: "total" | "deposit" | "other", label: string, value: string];
  const rows: Row[] =
    c.kind === "receipt"
      ? [["other", t("row_service"), what], ["total", t("row_total"), money(c.subtotalCents)], ["other", t("row_ref"), c.ref]]
      : [
          ["other", t("row_when"), when],
          ["other", t("row_service"), what],
          ...(c.staffName ? ([["other", t("row_with"), c.staffName]] as Row[]) : []),
          ["other", t("row_where"), where],
          ["total", t("row_total"), money(c.subtotalCents)],
          ["other", t("row_ref"), c.ref],
        ];
  if (depositDue && c.kind !== "cancelled" && c.kind !== "receipt") rows.splice(4, 0, ["deposit", t("row_deposit"), money(c.depositCents)]);
  const cta: [string, string] | null =
    c.kind === "receipt" ? [t("cta_receipt"), `${SITE_URL}/r/${c.reviewToken}`] : c.kind === "cancelled" ? [t("cta_again", vars), `${SITE_URL}/${c.handle}`] : [t("cta_page"), page];
  const contact = c.contactPhone
    ? t("contact_phone", { business: c.businessName, phone: formatPhone(c.contactPhone, c.country as Country) })
    : t("contact_none");
  const payLine = depositDue && c.kind === "confirmation" ? t("pay_line", { amount: money(c.depositCents), business: c.businessName, note: c.paymentNote ? `: ${c.paymentNote}` : "", link: c.paymentLink ? ` ${c.paymentLink}` : "" }) : "";
  const footer = t("footer", vars);

  const text = [intro, "", ...rows.map(([, k, v]) => `${k}: ${v}`), payLine && `\n${payLine}`, cta && `\n${cta[0]}: ${cta[1]}`, `\n${contact}`, `\n${footer}`]
    .filter((x) => x !== "")
    .join("\n");

  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#0A0C10;font-family:Inter,Arial,sans-serif;color:#F4F6FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161A21;border:1px solid #262B35;border-radius:24px;padding:28px">
<tr><td style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4DD8FF;padding-bottom:8px">${esc(c.businessName)}</td></tr>
<tr><td style="font-size:24px;font-weight:800;line-height:1.2;padding-bottom:12px">${esc(subject)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#C9D0DC;padding-bottom:18px">${esc(intro)}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #262B35">
${rows.map(([id, k, v]) => `<tr><td style="padding:10px 0;color:#9AA3B2;font-size:14px">${esc(k)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:600;${id === "total" || id === "deposit" ? "color:#FFB547" : ""}">${esc(v)}</td></tr>`).join("")}
</table></td></tr>
${payLine ? `<tr><td style="padding-top:14px;font-size:14px;line-height:1.6;color:#F4F6FA">${esc(payLine)}</td></tr>` : ""}
${cta ? `<tr><td style="padding-top:22px"><a href="${esc(cta[1])}" style="display:inline-block;background:#4DD8FF;color:#04121A;font-weight:700;text-decoration:none;border-radius:16px;padding:14px 22px">${esc(cta[0])}</a></td></tr>` : ""}
${c.contactPhone ? `<tr><td style="padding-top:18px;font-size:14px;color:#9AA3B2">${esc(contact)} · <a href="${esc(whatsappUrl(c.contactPhone, t("wa_msg", { business: c.businessName, name: c.firstName, ref: c.ref })))}" style="color:#7ff0a8">WhatsApp</a></td></tr>` : ""}
</table>
<p style="max-width:520px;font-size:12px;color:#6b7383;line-height:1.5;margin:16px auto 0">${esc(footer)}</p>
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
      sender: { name: emailT(isLocale(c.lang) ? c.lang : "en")("sender", { business: c.businessName.slice(0, 60) }), email: process.env.EMAIL_FROM ?? "support@beadup.app" },
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
