import { siteUrl } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { optOutIntent, validTwilioSignature } from "@/lib/twilio";

// Twilio inbound SMS webhook (Messaging Service "incoming messages" URL).
// Records STOP / START so Beadup never texts an opted-out number (rules.md
// section 4, TCPA). Every request's signature is verified.

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = (status = 200) => new Response(EMPTY_TWIML, { status, headers: { "Content-Type": "text/xml" } });

export async function POST(request: Request): Promise<Response> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const db = supabaseAdmin();
  if (!token || !db) return new Response("not configured", { status: 503 });

  const raw = await request.text();
  if (raw.length > 20_000) return new Response("too large", { status: 413 });
  const params = new URLSearchParams(raw);
  const url = `${siteUrl()}/api/twilio/inbound`;
  if (!validTwilioSignature(token, url, params, request.headers.get("x-twilio-signature"))) {
    return new Response("invalid signature", { status: 403 });
  }

  const from = params.get("From") ?? "";
  if (!/^\+[1-9]\d{7,14}$/.test(from)) return twiml();
  const intent = optOutIntent(params.get("Body") ?? "", params.get("OptOutType"));
  if (intent) {
    const { error } = await db.rpc("record_sms_opt_out", { p_phone: from, p_opted_out: intent === "stop" });
    if (error) return new Response("retry", { status: 500 }); // Twilio retries on 5xx
  }
  // No auto-reply here: the Messaging Service's opt-out settings send the
  // carrier-required STOP/START/HELP confirmations.
  return twiml();
}
