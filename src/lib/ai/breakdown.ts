// AI dish breakdown: a campus menu item (and optionally a plate photo) becomes its parts and grams.
// The model only estimates; we ground every part in our verified foods table and clamp the numbers.
import { aiJson, type AiJsonResult } from "./client";
import { matchFood } from "../match";
import type { DishPart, DishRole, Food } from "../types";

export type BreakdownInput = { menuItemName: string; cafeteria: string; priceNgn: number; photoBase64?: string };

const ROLES = new Set<DishRole>(["protein", "staple", "soup", "side"]);
const MAX_PARTS = 8;

export const BREAKDOWN_SYSTEM = `You are a Nigerian food analyst for university cafeterias in Abuja.
You break a cafeteria menu item into the foods on a typical student plate and estimate each one's weight.
Answer with JSON only.`;

/** The user prompt. Lists our foods with their measurement basis so grams come back on that basis. */
export function buildBreakdownPrompt(input: BreakdownInput, foods: Food[]): string {
  const list = foods
    .map((f) => `- ${f.food}${f.local_name && f.local_name !== f.food ? ` (${f.local_name})` : ""}: grams as ${(f.basis ?? "as eaten").toLowerCase()}`)
    .join("\n");
  return `Menu item: "${input.menuItemName}"
Cafeteria: ${input.cafeteria}, Nigerian university campus. Student price about ₦${Math.round(input.priceNgn)}.
${input.photoBase64 ? "A photo of one real plate is attached: use it for the parts and portion sizes.\n" : ""}
List every food on one typical serving of this item.
Use a name from this list in "food" whenever one fits; otherwise write your own short name:
${list}

Weights: give "grams" on the basis shown for that food. For a food listed as dry, give the dry weight that went into the cooked portion (for example 250 g of cooked jollof rice is about 85 g of dry rice). For raw meat, give the raw weight of the piece served.
Roles: "protein" for meat, fish, egg, beans, soy and other protein foods; "staple" for rice, swallow, bread, yam, noodles; "soup" for soups, stews and sauces; "side" for anything else.
List each meat or fish once, as its own "protein" part. A soup, stew or sauce part is the sauce only, without the meat in it.
Do not list cooking oil, salt, seasoning or spices as parts.
If you are unsure, give your best estimate and a confidence below 0.6.

Return JSON exactly in this shape:
{"parts": [{"food": "string", "grams": number, "role": "protein|staple|soup|side", "confidence": number}]}`;
}

export type BreakdownPart = DishPart & { confidence: number };

/** Never trust model JSON: keep valid parts only, clamp grams and ground each one in our foods table. */
export function sanitizeBreakdown(raw: unknown, foods: Food[]): BreakdownPart[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.parts) ? o.parts : Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: BreakdownPart[] = [];
  for (const item of list) {
    if (out.length >= MAX_PARTS) break;
    const p = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const label = typeof p.food === "string" ? p.food.trim().slice(0, 60) : typeof p.label === "string" ? p.label.trim().slice(0, 60) : "";
    const grams = Number(p.grams);
    if (!label || !Number.isFinite(grams) || grams <= 0) continue;
    const role = ROLES.has(p.role as DishRole) ? (p.role as DishRole) : "side";
    const conf = Number(p.confidence);
    // Exact when the AI used our name, with or without the local name we list after it: "Rice, milled (Rice)".
    const l = label.toLowerCase();
    const exact = foods.find((f) => f.food.toLowerCase() === l || (f.local_name && `${f.food} (${f.local_name})`.toLowerCase() === l));
    // Otherwise match on the name only, never on the AI's note in brackets:
    // "Vegetable oil (used for frying chicken)" must not become chicken.
    const head = label.split("(")[0].trim();
    let match = exact ?? (head ? matchFood(head, null, foods) : null);
    // A soup or sauce only counts as one of our soups: "Beef stew" is not beef, "jollof sauce" is not rice,
    // "tomato stew (no meat)" is not egusi soup.
    if (!exact && match && role === "soup" && !(/soup/i.test(match.food) && head.toLowerCase().includes(match.food.toLowerCase().split(/[\s,(]/)[0])))
      match = null;
    out.push({
      foodId: match?.id ?? null,
      // Our own name only when the AI used it exactly; otherwise keep the AI's words ("Spaghetti", not "Bread").
      label: exact ? (exact.local_name && exact.local_name !== exact.food ? exact.local_name : exact.food) : label,
      grams: Math.round(Math.min(800, grams)),
      role,
      confidence: Number.isFinite(conf) ? Math.round(Math.min(1, Math.max(0, conf)) * 100) / 100 : 0.5,
    });
  }
  return out;
}

/** Ask the AI for the parts of a dish. `ask` lets callers add caching (and tests mock the model). */
export async function breakdownDish(
  input: BreakdownInput,
  foods: Food[],
  ask: (req: Parameters<typeof aiJson>[0]) => Promise<Pick<AiJsonResult, "json">> = aiJson,
): Promise<BreakdownPart[]> {
  const { json } = await ask({
    system: BREAKDOWN_SYSTEM,
    text: buildBreakdownPrompt(input, foods),
    imageBase64Jpeg: input.photoBase64,
    maxTokens: 800,
  });
  return sanitizeBreakdown(json, foods);
}
