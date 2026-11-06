import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Resolves the signed-in detailer from a Supabase access token sent as
 * "Authorization: Bearer <token>" (the mobile app keeps it in secure storage).
 * Returns the user id, or null if the token is missing, expired or forged.
 */
export async function detailerFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header);
  const db = supabaseAdmin();
  if (!match || !db) return null;
  const { data, error } = await db.auth.getUser(match[1]); // verified by Supabase Auth
  if (error || !data.user) return null;
  return data.user.id;
}
