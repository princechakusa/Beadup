import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio request validation: base64(HMAC-SHA1(auth token, url + each POST
 * param name+value, sorted by name)), compared in constant time.
 * `url` must be the exact public URL Twilio was configured to call.
 */
export function validTwilioSignature(authToken: string, url: string, params: URLSearchParams, signature: string | null): boolean {
  if (!signature) return false;
  const data =
    url +
    [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => k + v)
      .join("");
  const expected = Buffer.from(createHmac("sha1", authToken).update(data, "utf8").digest("base64"));
  const got = Buffer.from(signature);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Carrier-standard keywords (CTIA). Twilio's Advanced Opt-Out also replies
// to these automatically; we only record the choice.
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START_WORDS = new Set(["START", "UNSTOP", "YES", "OPTIN"]);

export function optOutIntent(body: string, optOutType: string | null): "stop" | "start" | null {
  const type = optOutType?.toUpperCase();
  if (type === "STOP") return "stop";
  if (type === "START") return "start";
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (STOP_WORDS.has(word)) return "stop";
  if (START_WORDS.has(word)) return "start";
  return null;
}
