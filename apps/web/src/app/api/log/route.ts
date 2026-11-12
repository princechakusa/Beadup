import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Error reports from the website (error boundaries) and the app (ErrorBoundary).
 * Stored in `error_log` for /admin. Rate limited per IP; never stores IPs,
 * personal details or query strings.
 */
const Body = z.object({
  source: z.enum(["web", "app"]),
  message: z.string().max(2000),
  where: z.string().max(2000).default(""),
  stack: z.string().max(8000).default(""),
  release: z.string().max(60).default(""),
});

// Strip query strings, emails and long digit runs (phones, card-like numbers).
const scrub = (s: string, max: number) =>
  s
    .replace(/\?[^\s)]*/g, "")
    .replace(/[^\s@]+@[^\s@]+/g, "<email>")
    .replace(/\+?\d[\d\s-]{6,}\d/g, "<number>")
    .slice(0, max);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const db = supabaseAdmin();
  if (!db) return new Response(null, { status: 204 });
  const ip = createHash("sha256").update(clientIp(await headers())).digest("hex").slice(0, 32);
  const { data: ok } = await db.rpc("hit_rate_limit", { p_key: `log:ip:${ip}`, p_limit: 20, p_window_seconds: 3600 });
  if (ok === false) return new Response(null, { status: 429 });
  const b = parsed.data;
  await db.from("error_log").insert({
    source: b.source,
    message: scrub(b.message, 500) || "(no message)",
    where_at: scrub(b.where, 300),
    stack: scrub(b.stack, 2000),
    release: b.release.slice(0, 60),
  });
  if (Math.random() < 0.02) await db.rpc("prune_error_log");
  return new Response(null, { status: 204 });
}
