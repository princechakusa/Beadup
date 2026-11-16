/**
 * IndexNow key file (https://www.indexnow.org). Set INDEXNOW_KEY to a random
 * 8-128 character string of letters, numbers and dashes, then Bing, Yandex
 * and others can verify it at /indexnow/<key>.txt (pass that as keyLocation
 * when submitting URLs; see docs/SEO_CHECKLIST.md). Any other path is a 404.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  const requested = (await ctx.params).key.replace(/\.txt$/, "");
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key) || requested !== key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
