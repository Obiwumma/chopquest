import { getMenuItem, saveBreakdown } from "@/lib/server/cafeterias";
import { cachedAiJson, cacheKey } from "@/lib/server/ai-cache";
import { aiErrorMessage, aiJson } from "@/lib/ai/client";
import { breakdownDish } from "@/lib/ai/breakdown";
import { listFoods } from "@/lib/foods-db";
import type { DishPart } from "@/lib/types";

export const maxDuration = 60;

const ROLES = new Set(["protein", "staple", "soup", "side"]);

function cleanParts(raw: unknown): DishPart[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) return null;
  const parts: DishPart[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const grams = Number(p?.grams);
    const foodId = p?.foodId == null ? null : Number(p.foodId);
    if (typeof p?.label !== "string" || !p.label.trim() || !Number.isFinite(grams) || grams <= 0 || grams > 2000) return null;
    if (foodId !== null && (!Number.isInteger(foodId) || foodId <= 0)) return null;
    if (!ROLES.has(String(p.role))) return null;
    parts.push({ foodId, label: p.label.trim().slice(0, 60), grams: Math.round(grams), role: p.role as DishPart["role"] });
  }
  return parts;
}

const MAX_PHOTO_BASE64 = 3_000_000;

// POST /api/menu-items/:id/breakdown
//   {}                        -> the saved breakdown, or asks the AI (OpenRouter) and saves its answer
//   { refresh: true, photo? } -> asks the AI again (optionally with a plate photo, never stored)
//   { parts: DishPart[] }     -> saves the manager's corrected breakdown
// -> { breakdown: DishPart[], source: "saved" | "ai" | "manager", confidence?: number[] }
export async function POST(req: Request, ctx: RouteContext<"/api/menu-items/[id]/breakdown">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Bad id." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { parts?: unknown; refresh?: unknown; photo?: unknown };
  try {
    const item = await getMenuItem(id);
    if (!item) return Response.json({ error: "Dish not found." }, { status: 404 });

    if (body.parts !== undefined) {
      const parts = cleanParts(body.parts);
      if (!parts) return Response.json({ error: "Check the parts: each needs a name, grams and a role." }, { status: 400 });
      await saveBreakdown(id, parts);
      return Response.json({ breakdown: parts, source: "manager" });
    }
    if (item.breakdown?.length && body.refresh !== true) return Response.json({ breakdown: item.breakdown, source: "saved" });

    let photo: string | undefined;
    if (typeof body.photo === "string" && body.photo.length > 100) {
      photo = body.photo.replace(/^data:image\/\w+;base64,/, "");
      if (photo.length > MAX_PHOTO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(photo))
        return Response.json({ error: "That photo can't be used. Try a smaller JPEG." }, { status: 400 });
    }

    const foods = await listFoods();
    const input = { menuItemName: item.name, cafeteria: item.cafeteriaName, priceNgn: item.priceNgn, photoBase64: photo };
    let parts;
    try {
      parts = await breakdownDish(input, foods, (req) =>
        cachedAiJson(cacheKey("breakdown", { name: item.name, price: item.priceNgn, cafeteria: item.cafeteriaName, photo: photo ?? null }), () => aiJson(req)),
      );
    } catch (e) {
      console.error("ai breakdown failed", e);
      const { message, status } = aiErrorMessage(e);
      return Response.json({ error: message, code: "ai_failed" }, { status });
    }
    if (!parts.length)
      return Response.json({ error: "Chloe couldn't find the parts of this dish. Add them by hand.", code: "ai_empty" }, { status: 422 });

    const breakdown: DishPart[] = parts.map(({ foodId, label, grams, role }) => ({ foodId, label, grams, role }));
    await saveBreakdown(id, breakdown);
    return Response.json({ breakdown, source: "ai", confidence: parts.map((p) => p.confidence) });
  } catch (e) {
    console.error("breakdown failed", e);
    return Response.json({ error: "Couldn't break down this dish. Try again." }, { status: 500 });
  }
}
