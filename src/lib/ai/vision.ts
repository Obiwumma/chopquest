// Photo scanner: identifies the foods on a plate photo. Runs on OpenRouter (team credits).
import { aiJson } from "./client";
import type { VisionItem, VisionResult } from "../foods";

export const VISION_PROMPT = `You are a Nigerian food recognition assistant. Look at the photo of a meal and identify every visible food.
Use Nigerian dish names where they apply (jollof rice, ewa agoyin, moi moi, akara, okpa, efo riro, egusi soup, beans porridge, dodo, garri, eba, amala, pounded yam, suya, awara, Indomie, kuli-kuli).
For each food, estimate the portion in household units (spoons, wraps, pieces, cups).
If you are unsure, give your best guess and set confidence below 0.6.
Return ONLY valid JSON in this exact shape:
{"dish_name": "string", "items": [{"food": "string", "local_name": "string", "portion": "string", "estimated_grams": number, "cooking_method": "boiled|fried|steamed|stewed|raw|roasted", "confidence": number}]}`;

const METHODS = new Set(["boiled", "fried", "steamed", "stewed", "raw", "roasted"]);
const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/** Never trust model JSON: coerce it into the shape the app expects, dropping junk items. */
export function sanitizeVision(raw: unknown): VisionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items: VisionItem[] = (Array.isArray(o.items) ? o.items : [])
    .slice(0, 12)
    .map((it): VisionItem | null => {
      const i = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const food = str(i.food);
      if (!food) return null;
      const method = str(i.cooking_method, 20).toLowerCase();
      return {
        food,
        local_name: str(i.local_name),
        portion: str(i.portion),
        estimated_grams: Math.round(clamp(i.estimated_grams, 0, 2000, 100)),
        cooking_method: METHODS.has(method) ? method : "",
        confidence: Math.round(clamp(i.confidence, 0, 1, 0.5) * 100) / 100,
      };
    })
    .filter((x): x is VisionItem => x !== null);
  return { dish_name: str(o.dish_name, 100) || "Your meal", items };
}

export async function analyzeMeal(base64Jpeg: string): Promise<VisionResult> {
  const { json } = await aiJson({
    system: "You are a Nigerian food recognition assistant. Answer with JSON only.",
    text: VISION_PROMPT,
    imageBase64Jpeg: base64Jpeg,
    maxTokens: 900,
  });
  return sanitizeVision(json);
}
