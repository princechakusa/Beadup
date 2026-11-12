import type { Instrumentation } from "next";

/** Server errors go to `error_log` (shown in /admin). Never the request body, query string or headers. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    const db = supabaseAdmin();
    if (!db) return;
    const e = err instanceof Error ? err : new Error(String(err));
    const digest = (err as { digest?: string })?.digest;
    await db.from("error_log").insert({
      source: "server",
      message: `${e.message}${digest ? ` (digest ${digest})` : ""}`.slice(0, 500) || "(no message)",
      where_at: `${request.method} ${request.path.split("?")[0]} [${context.routeType}]`.slice(0, 300),
      stack: (e.stack ?? "").slice(0, 2000),
    });
  } catch {
    // reporting must never throw
  }
};
