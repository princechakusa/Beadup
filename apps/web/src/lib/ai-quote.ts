import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Photo -> suggested quote (rules.md section 5). The model only picks from the
// detailer's own catalog by id; prices always come from our database, and the
// detailer approves every number before anything is sent to a client.

export const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 90_000, maxRetries: 2 });
  return client;
}

export const suggestionSchema = z.object({
  is_vehicle: z.boolean(),
  not_vehicle_reason: z.string().nullable(),
  vehicle_description: z.string(),
  vehicle_size: z.enum(["sedan", "suv", "truck"]),
  conditions: z.array(
    z.object({
      label: z.string(),
      area: z.string(),
      severity: z.enum(["light", "moderate", "heavy"]),
    }),
  ),
  service_id: z.string().nullable(),
  add_on_ids: z.array(z.string()),
  note: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

// Frozen: no per-request values here, so it stays identical across calls.
const SYSTEM = `You help a mobile car detailer price a job from photos of a client's vehicle.

Look at the photos and the detailer's price list, then suggest the one service and any add-ons that fit the vehicle's condition.

- Choose only ids that appear in the price list. Never invent services or add-ons, and never state prices.
- If the photos do not show a road vehicle (car, SUV, truck, van), set is_vehicle to false, give a short neutral reason, set service_id to null and add_on_ids to an empty list.
- vehicle_size: "sedan" for cars, coupes, hatchbacks and small crossovers; "suv" for SUVs, minivans and mid or large crossovers; "truck" for pickups and full-size vans.
- conditions: the visible things that change the work, such as pet hair, heavy soil, mud, stains, odor signs, swirl marks, scratches, water spots, oxidation or brake dust. Give each a short label, the area (for example "rear seats" or "hood") and a severity. List at most eight.
- Describe only the vehicle and its condition. Do not describe people, read license plates, or comment on anything else in the photos.
- vehicle_description: make, model and color if you can tell, otherwise a plain description like "white mid-size SUV".
- note: one or two short sentences the detailer can read, for example what to double-check in person.
- confidence: "low" when the photos are dark, blurry, partial or ambiguous.`;

export type CatalogForAi = {
  services: { id: string; name: string; description: string }[];
  addOns: { id: string; name: string }[];
};

export class AiDeclinedError extends Error {}

export async function suggestQuote(
  ai: Anthropic,
  photos: { base64: string }[],
  catalog: CatalogForAi,
  detailerNote: string,
): Promise<Suggestion> {
  const response = await ai.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(suggestionSchema) },
    // Re-run a safety-classifier decline on Anthropic's recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...photos.map((p) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data: p.base64 },
          })),
          {
            type: "text",
            text: `Price list:\n${JSON.stringify(catalog)}${detailerNote ? `\n\nDetailer's note: ${detailerNote}` : ""}`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new AiDeclinedError("declined");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`no structured output (stop_reason ${response.stop_reason})`);

  // Never trust ids blindly: keep only ones that exist in this detailer's catalog.
  const serviceIds = new Set(catalog.services.map((s) => s.id));
  const addOnIds = new Set(catalog.addOns.map((a) => a.id));
  return {
    ...parsed,
    service_id: parsed.is_vehicle && parsed.service_id && serviceIds.has(parsed.service_id) ? parsed.service_id : null,
    add_on_ids: parsed.is_vehicle ? [...new Set(parsed.add_on_ids.filter((id) => addOnIds.has(id)))] : [],
    conditions: parsed.conditions.slice(0, 8).map((c) => ({ ...c, label: c.label.slice(0, 60), area: c.area.slice(0, 40) })),
    vehicle_description: parsed.vehicle_description.slice(0, 120),
    note: parsed.note.slice(0, 300),
    not_vehicle_reason: parsed.not_vehicle_reason?.slice(0, 200) ?? null,
  };
}

/** Development stand-in when no API key is configured. Clearly flagged. */
export function mockSuggestion(catalog: CatalogForAi): Suggestion {
  return {
    is_vehicle: true,
    not_vehicle_reason: null,
    vehicle_description: "Mid-size SUV (sample suggestion, AI not configured)",
    vehicle_size: "suv",
    conditions: [{ label: "Pet hair", area: "rear seats", severity: "moderate" }],
    service_id: catalog.services[1]?.id ?? catalog.services[0]?.id ?? null,
    add_on_ids: catalog.addOns.slice(0, 1).map((a) => a.id),
    note: "Sample suggestion for development. Add ANTHROPIC_API_KEY to get real photo analysis.",
    confidence: "low",
  };
}
