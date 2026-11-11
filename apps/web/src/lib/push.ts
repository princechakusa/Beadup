import "server-only";
import { formatMoney, type Country } from "./countries";
import { supabaseAdmin } from "./supabase-admin";

// Booking alerts to the detailer's phone via the Expo push service.
// Best effort: alerts are optional and the app works without them, so a
// failure here never affects a payment or booking.

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

async function sendToDetailer(detailerId: string, title: string, body: string, url: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const { data: rows } = await db.from("push_tokens").select("token").eq("detailer_id", detailerId);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (!tokens.length) return;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(tokens.map((to) => ({ to, title, body, data: { url }, channelId: "bookings", sound: null }))),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
    // Drop tokens for uninstalled apps or revoked permission.
    const dead = (json?.data ?? [])
      .map((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? tokens[i] : null))
      .filter((t): t is string => !!t);
    if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  } catch (e) {
    console.error("push send failed", e instanceof Error ? e.message : e);
  }
}

/** "New booking" / "Balance paid" alert for a booking's detailer. */
export async function notifyPayment(bookingId: string, kind: "deposit" | "balance" | "booked" | "deposit_reported"): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const { data } = await db
    .from("bookings")
    .select("detailer_id, service_name, starts_at, subtotal_cents, deposit_cents, client:clients(name), detailer:detailers(timezone, country)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return;
  const b = data as unknown as {
    detailer_id: string;
    service_name: string;
    starts_at: string;
    subtotal_cents: number;
    deposit_cents: number;
    client: { name: string } | null;
    detailer: { timezone: string; country: Country } | null;
  };
  const tz = b.detailer?.timezone ?? "America/Chicago";
  const [first, last] = (b.client?.name ?? "A client").split(" ");
  const who = last ? `${first} ${last[0]}.` : first;
  const when = new Date(b.starts_at).toLocaleString("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" });
  const usd = (c: number) => formatMoney(c, b.detailer?.country ?? "US"); // the detailer's own currency

  if (kind === "booked") {
    // External payments: the client pays the deposit to the detailer directly.
    await sendToDetailer(b.detailer_id, "New booking", `${who} booked ${b.service_name}, ${when}. Deposit ${usd(b.deposit_cents)} comes to you directly.`, `/booking/${bookingId}`);
  } else if (kind === "deposit_reported") {
    // The client says so; the detailer checks their account and confirms in the app.
    await sendToDetailer(b.detailer_id, `${who} says the deposit is sent`, `${usd(b.deposit_cents)} for ${b.service_name}, ${when}. Check it arrived, then tap Deposit received.`, `/booking/${bookingId}`);
  } else if (kind === "deposit") {
    await sendToDetailer(b.detailer_id, "New booking", `${who} booked ${b.service_name}, ${when}. Deposit paid.`, `/booking/${bookingId}`);
  } else {
    await sendToDetailer(b.detailer_id, `${who} paid you`, `${b.service_name} paid in full, ${usd(b.subtotal_cents)}.`, `/paid/${bookingId}`);
  }
}

/** "New 2-star review" alert, with the start of what the client wrote. Opens the Reviews screen. */
export async function notifyReview(token: string, rating: number, body: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const { data } = await db.from("bookings").select("detailer_id, client:clients(name)").eq("review_token", token).maybeSingle();
  if (!data) return;
  const client = (Array.isArray(data.client) ? data.client[0] : data.client) as { name?: string } | null;
  const first = (client?.name ?? "A client").split(" ")[0];
  const text = body.trim();
  const said = text ? `: "${text.length > 90 ? `${text.slice(0, 89)}…` : text}"` : ".";
  await sendToDetailer(data.detailer_id as string, `New ${rating}-star review`, `${first} rated your detail ${rating} out of 5${said}`, "/reviews");
}

/** A client asked, from their booking page, to move or cancel. Opens the booking in the app. */
export async function notifyRequest(bookingId: string, kind: "reschedule" | "cancel"): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const { data } = await db
    .from("bookings")
    .select("detailer_id, service_name, starts_at, client:clients(name), detailer:detailers(timezone)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return;
  const b = data as unknown as {
    detailer_id: string;
    service_name: string;
    starts_at: string;
    client: { name: string } | null;
    detailer: { timezone: string } | null;
  };
  const [first, last] = (b.client?.name ?? "A client").split(" ");
  const who = last ? `${first} ${last[0]}.` : first;
  const when = new Date(b.starts_at).toLocaleString("en-US", {
    timeZone: b.detailer?.timezone ?? "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const title = kind === "cancel" ? `${who} asks to cancel` : `${who} asks for a new time`;
  await sendToDetailer(b.detailer_id, title, `${b.service_name}, ${when}. Open the booking to reply.`, `/booking/${bookingId}`);
}
