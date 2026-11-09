import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authClient, clearAdminSession, isAdminEmail, sameOrigin, setAdminSession } from "@/lib/admin";
import { clientIp } from "@/lib/client-ip";
import { supabaseAdmin } from "@/lib/supabase-admin";

const body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("send"), email: z.email().max(254) }),
  z.object({ step: z.literal("verify"), email: z.email().max(254), code: z.string().regex(/^\d{6,10}$/) }),
]);

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Creates the allow-listed admin's login if missing and marks the email confirmed. */
async function ensureConfirmedUser(db: SupabaseClient, email: string) {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (!created.error) return;
  // Already registered: find it and confirm it if a signup was left pending.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      if (!user.email_confirmed_at) await db.auth.admin.updateUserById(user.id, { email_confirm: true });
      return;
    }
    if (data.users.length < 200) return;
  }
}

/**
 * Admin sign-in: "send" emails a one-time code (only to ADMIN_EMAILS), "verify"
 * exchanges it for a session kept in an httpOnly cookie. Rate limited by IP.
 * The reply never says whether an email is an admin.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await sameOrigin())) return new Response("forbidden", { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const db = supabaseAdmin();
  const auth = authClient();
  if (!db || !auth) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });

  const ip = clientIp(await headers());
  const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: `admin:${parsed.data.step}:${hash(ip)}`, p_limit: 8, p_window_seconds: 900 });
  if (allowed !== true) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const email = parsed.data.email.toLowerCase();
  if (parsed.data.step === "send") {
    // Same answer either way, so the form can't be used to find admin emails.
    if (isAdminEmail(email)) {
      // A brand-new or unconfirmed address would get Supabase's "Confirm
      // signup" email (a link, no code). Make sure the admin's login exists
      // and is confirmed first, so they get the "sign-in code" email.
      await ensureConfirmedUser(db, email);
      await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    }
    return Response.json({ ok: true });
  }

  if (!isAdminEmail(email)) return Response.json({ ok: false, error: "code" }, { status: 401 });
  const { data, error } = await auth.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  if (error || !data.session) return Response.json({ ok: false, error: "code" }, { status: 401 });
  await setAdminSession(data.session.access_token, data.session.expires_in);
  await db.from("audit_log").insert({ actor: email, event: "admin.sign_in", data: {} });
  return Response.json({ ok: true });
}

export async function DELETE(): Promise<Response> {
  if (!(await sameOrigin())) return new Response("forbidden", { status: 403 });
  await clearAdminSession();
  return Response.json({ ok: true });
}
