import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { AiDeclinedError, aiConfigured, mockSuggestion, modelFor, suggestQuote, type AiProvider, type CatalogForAi } from "@/lib/ai-quote";
import { detailerFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/quotes/ai: the detailer's photos (already uploaded to their
// private folder in the quote-photos bucket) -> suggested quote. Requires the
// detailer's recorded AI consent. Returns line items priced from the
// database; the app shows them as an estimate the detailer must approve.

export const maxDuration = 120;

const body = z.object({
  photoPaths: z
    .array(z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{8,80}\.jpg$/))
    .min(1)
    .max(6),
  note: z.string().max(300).optional().default(""),
});

const SIZES = ["sedan", "suv", "truck"] as const;

export async function POST(request: Request): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new Response("not configured", { status: 503 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { photoPaths, note } = parsed.data;
  // Photos must live in the caller's own folder.
  if (photoPaths.some((p) => !p.startsWith(`${userId}/`))) return Response.json({ error: "invalid" }, { status: 400 });

  const { data: rl } = await db.rpc("hit_rate_limit", { p_key: `ai-quote:${userId}`, p_limit: 30, p_window_seconds: 3600 });
  if (rl !== true) return Response.json({ error: "rate_limited" }, { status: 429 });

  const [{ data: detailer }, { data: providerRaw }] = await Promise.all([
    db.from("detailers").select("ai_consent_at, ai_consent_provider").eq("id", userId).maybeSingle(),
    db.rpc("current_ai_provider"),
  ]);
  const provider: AiProvider = providerRaw === "anthropic" ? "anthropic" : "openai";
  if (!detailer) return Response.json({ error: "no_profile" }, { status: 409 });
  // Consent covers one named provider; a provider change asks again.
  if (!detailer.ai_consent_at || detailer.ai_consent_provider !== provider) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }

  const [{ data: services }, { data: addOns }] = await Promise.all([
    db.from("services").select("id, name, description, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents").eq("detailer_id", userId).eq("active", true).order("sort_order"),
    db.from("add_ons").select("id, name, price_cents").eq("detailer_id", userId).eq("active", true).order("sort_order"),
  ]);
  if (!services?.length) return Response.json({ error: "no_services" }, { status: 409 });
  const catalog: CatalogForAi = {
    services: services.map((s) => ({ id: s.id, name: s.name, description: s.description })),
    addOns: (addOns ?? []).map((a) => ({ id: a.id, name: a.name })),
  };

  const live = aiConfigured(provider);
  if (!live && process.env.NODE_ENV === "production") return Response.json({ error: "ai_unavailable" }, { status: 503 });

  let suggestion;
  try {
    if (live) {
      const photos = await Promise.all(
        photoPaths.map(async (path) => {
          const { data, error } = await db.storage.from("quote-photos").download(path);
          if (error || !data) throw new Error("photo missing");
          if (data.size > 5 * 1024 * 1024) throw new Error("photo too large");
          return { base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
        }),
      );
      suggestion = await suggestQuote(provider, photos, catalog, note);
    } else {
      suggestion = mockSuggestion(catalog);
    }
  } catch (e) {
    if (e instanceof AiDeclinedError) return Response.json({ error: "ai_declined" }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) return Response.json({ error: "busy" }, { status: 503 });
    if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) {
      console.error("ai quote api error", provider, e.status);
      return Response.json({ error: "ai_unavailable" }, { status: 502 });
    }
    console.error("ai quote failed", e instanceof Error ? e.message : e);
    return Response.json({ error: "ai_unavailable" }, { status: 502 });
  }

  if (!suggestion.is_vehicle) {
    return Response.json({ error: "not_a_vehicle", reason: suggestion.not_vehicle_reason }, { status: 422 });
  }

  // Price the suggestion from the database, never from the model.
  const size = SIZES.includes(suggestion.vehicle_size) ? suggestion.vehicle_size : "suv";
  const service = services.find((s) => s.id === suggestion.service_id);
  const items = [
    ...(service ? [{ kind: "service", id: service.id, label: service.name, cents: service[`price_${size}_cents`] as number }] : []),
    ...(addOns ?? [])
      .filter((a) => suggestion.add_on_ids.includes(a.id))
      .map((a) => ({ kind: "add_on", id: a.id, label: a.name, cents: a.price_cents as number })),
  ];

  const { data: quoteId } = await db.rpc("create_ai_draft_quote", {
    p_detailer_id: userId,
    p_vehicle_size: size,
    p_vehicle_desc: suggestion.vehicle_description,
    p_suggestion: { ...suggestion, provider, model: live ? modelFor(provider) : "mock", items },
    p_photo_paths: photoPaths,
  });

  return Response.json({
    quoteId,
    mock: !live,
    vehicleSize: size,
    vehicleDescription: suggestion.vehicle_description,
    conditions: suggestion.conditions,
    serviceId: service?.id ?? null,
    addOnIds: suggestion.add_on_ids,
    note: suggestion.note,
    confidence: suggestion.confidence,
    items,
  });
}
