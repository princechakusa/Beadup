import { z } from "zod";
import { HANDLE_RE } from "@/lib/booking-page";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * A detailer's public photo ("avatar") or portfolio photo (item id), served
 * from the private profile-media bucket. The booking page's CSP allows images
 * from this site only, and URLs carry the handle and item id, never the
 * detailer's user id or storage path. Published detailers only.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/media/[handle]/[item]">): Promise<Response> {
  const { handle, item } = await ctx.params;
  const id = item === "avatar" ? null : z.uuid().safeParse(item).success ? item : undefined;
  if (!HANDLE_RE.test(handle) || id === undefined) return new Response("not found", { status: 404 });
  const db = supabaseAdmin();
  if (!db) return new Response("not found", { status: 404 });

  const { data: path } = await db.rpc("media_path", { p_handle: handle, p_item_id: id });
  if (typeof path !== "string") return new Response("not found", { status: 404 });
  const { data: file, error } = await db.storage.from("profile-media").download(path);
  if (error || !file) return new Response("not found", { status: 404 });

  return new Response(file, {
    headers: {
      "Content-Type": "image/jpeg",
      // The page adds ?v=<version> for the avatar, so a new photo is a new URL.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
