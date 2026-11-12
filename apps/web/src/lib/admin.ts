import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

/*
 * Beadup admin (/admin). Who is an admin comes only from the ADMIN_EMAILS env
 * var (comma separated). Sign-in is a one-time email code from Supabase Auth,
 * handled on the server; the session token lives in an httpOnly, Secure,
 * SameSite=Strict cookie that page scripts can't read. Every admin API call
 * re-verifies the token with Supabase and re-checks the allow-list.
 */

export const ADMIN_COOKIE = "bd_admin";

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isAdminEmail = (email: string) => adminEmails().has(email.trim().toLowerCase());

/** Anon-key client for the OTP calls (no session persisted on the server). */
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** Same-origin check for state-changing admin requests (defence in depth on top of SameSite=Strict). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The signed-in admin's email, or null. */
export async function currentAdmin(): Promise<string | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const db = supabaseAdmin();
  if (!token || !db || !/^[A-Za-z0-9._-]{20,4096}$/.test(token)) return null;
  const { data, error } = await db.auth.getUser(token);
  const email = data.user?.email;
  if (error || !email || !isAdminEmail(email)) return null;
  return email.toLowerCase();
}

export async function setAdminSession(token: string, expiresIn: number) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(60, Math.min(expiresIn, 3600)),
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export type AdminOverview = {
  admin: string;
  totals: {
    detailers: number;
    newThisWeek: number;
    published: number;
    bookings30d: number;
    completed30d: number;
    pro: number;
    bonusPro: number;
    referrals: number;
    reviews: number;
    openDeletionRequests: number;
  };
  byCountry: Record<string, number>;
  detailers: {
    id: string;
    handle: string;
    businessName: string;
    country: string;
    createdAt: string;
    published: boolean;
    bookings: number;
    plan: "pro" | "free";
    bonusProUntil: string | null;
  }[];
  reviews: { id: string; rating: number; body: string; hidden: boolean; createdAt: string; handle: string }[];
  deletionRequests: { id: number; email: string; note: string; createdAt: string }[];
  errors: { id: number; source: string; message: string; where: string; createdAt: string }[];
};

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export async function loadOverview(admin: string): Promise<AdminOverview> {
  const db = supabaseAdmin();
  if (!db) throw new Error("no database");
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const head = { count: "exact" as const, head: true };

  const [detailers, newThisWeek, published, bookings30d, completed30d, referrals, reviewsCount, openDeletion] = await Promise.all([
    count(db.from("detailers").select("id", head)),
    count(db.from("detailers").select("id", head).gte("created_at", since(7))),
    count(db.from("detailers").select("id", head).eq("is_published", true)),
    count(db.from("bookings").select("id", head).gte("created_at", since(30)).in("status", ["confirmed", "completed", "no_show"])),
    count(db.from("bookings").select("id", head).gte("created_at", since(30)).eq("status", "completed")),
    count(db.from("referrals").select("referred_id", head)),
    count(db.from("reviews").select("id", head)),
    count(db.from("deletion_requests").select("id", head).eq("status", "open")),
  ]);

  const now = new Date().toISOString();
  const [{ data: accounts }, { data: list }, { data: reviews }, { data: deletions }, { data: countries }, { data: errors }] = await Promise.all([
    db.from("detailer_accounts").select("detailer_id, plan, plan_renews_at, bonus_pro_until"),
    db
      .from("detailers")
      .select("id, handle, business_name, country, created_at, is_published, bookings(count)")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("reviews")
      .select("id, rating, body, hidden, created_at, detailer:detailers(handle)")
      .order("created_at", { ascending: false })
      .limit(40),
    db.from("deletion_requests").select("id, email, note, created_at").eq("status", "open").order("created_at").limit(50),
    db.from("detailers").select("country"),
    db.from("error_log").select("id, source, message, where_at, created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  const acct = new Map((accounts ?? []).map((a) => [a.detailer_id as string, a]));
  const isPaid = (a?: { plan: string; plan_renews_at: string | null }) => !!a && a.plan === "pro" && (!a.plan_renews_at || a.plan_renews_at > now);
  const hasBonus = (a?: { bonus_pro_until: string | null }) => !!a?.bonus_pro_until && a.bonus_pro_until > now;
  const byCountry: Record<string, number> = {};
  for (const c of countries ?? []) byCountry[c.country as string] = (byCountry[c.country as string] ?? 0) + 1;

  return {
    admin,
    totals: {
      detailers,
      newThisWeek,
      published,
      bookings30d,
      completed30d,
      pro: (accounts ?? []).filter((a) => isPaid(a)).length,
      bonusPro: (accounts ?? []).filter((a) => !isPaid(a) && hasBonus(a)).length,
      referrals,
      reviews: reviewsCount,
      openDeletionRequests: openDeletion,
    },
    byCountry,
    detailers: (list ?? []).map((d) => {
      const a = acct.get(d.id as string);
      const b = d.bookings as unknown as { count: number }[] | null;
      return {
        id: d.id as string,
        handle: d.handle as string,
        businessName: d.business_name as string,
        country: d.country as string,
        createdAt: d.created_at as string,
        published: d.is_published as boolean,
        bookings: b?.[0]?.count ?? 0,
        plan: isPaid(a) || hasBonus(a) ? "pro" : "free",
        bonusProUntil: hasBonus(a) ? (a!.bonus_pro_until as string) : null,
      };
    }),
    reviews: (reviews ?? []).map((r) => {
      const d = (Array.isArray(r.detailer) ? r.detailer[0] : r.detailer) as { handle?: string } | null;
      return { id: r.id as string, rating: r.rating as number, body: r.body as string, hidden: r.hidden as boolean, createdAt: r.created_at as string, handle: d?.handle ?? "" };
    }),
    deletionRequests: (deletions ?? []).map((d) => ({ id: d.id as number, email: d.email as string, note: d.note as string, createdAt: d.created_at as string })),
    errors: (errors ?? []).map((e) => ({ id: e.id as number, source: e.source as string, message: e.message as string, where: e.where_at as string, createdAt: e.created_at as string })),
  };
}
