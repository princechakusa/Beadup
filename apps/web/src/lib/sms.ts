import "server-only";

export type SmsResult = { ok: true; id: string } | { ok: false; error: string; retry: boolean };

/** True when Twilio credentials and a 10DLC messaging service are configured. */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_SERVICE_SID,
  );
}

/**
 * Sends one text through Twilio's REST API. Uses a Messaging Service (needed
 * for US 10DLC registration, rules.md section 4), so Twilio handles STOP/HELP
 * keywords and the sender number pool.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !service) return { ok: false, error: "sms_not_configured", retry: false };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, MessagingServiceSid: service, Body: body }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
    if (res.ok && data.sid) return { ok: true, id: data.sid };
    // 21610: recipient replied STOP. Never retry those; 4xx are permanent too.
    return { ok: false, error: `twilio_${data.code ?? res.status}`, retry: res.status >= 500 || res.status === 429 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "network", retry: true };
  }
}
