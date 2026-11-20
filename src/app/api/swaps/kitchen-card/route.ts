import { getMenuItem } from "@/lib/server/cafeterias";
import { cachedAiJson, cacheKey } from "@/lib/server/ai-cache";
import { aiJson } from "@/lib/ai/client";
import { writeKitchenCard } from "@/lib/ai/kitchen-card";
import { listFoods } from "@/lib/foods-db";
import type { SwapOption } from "@/lib/types";

export const maxDuration = 60;

// POST /api/swaps/kitchen-card { menuItemId, option }
//   -> { card: KitchenCard, source: "ai" | "ai-retry" | "template", problems: string[] }
// The AI writes the card; the validator checks it against our foods. If the AI is down, out of
// credits or keeps breaking the rules, a template card built from the swap is returned instead.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { menuItemId?: unknown; option?: SwapOption } | null;
  const id = Number(body?.menuItemId);
  if (!Number.isInteger(id) || id <= 0 || !body?.option?.adds?.length || !Array.isArray(body.option.replaces))
    return Response.json({ error: "Pick a swap first." }, { status: 400 });
  try {
    const item = await getMenuItem(id);
    if (!item?.breakdown?.length) return Response.json({ error: "Dish not found." }, { status: 404 });
    const foods = await listFoods();
    const knownIds = new Set(foods.map((f) => f.id));
    if (!body.option.adds.every((a) => knownIds.has(Number(a.foodId))))
      return Response.json({ error: "That swap doesn't look right. Find swaps again." }, { status: 400 });

    const result = await writeKitchenCard(
      { dishName: item.name, breakdown: item.breakdown, option: body.option, foods },
      (aiReq) => cachedAiJson(cacheKey("card", aiReq), () => aiJson(aiReq)),
    );
    return Response.json(result);
  } catch (e) {
    console.error("kitchen card failed", e);
    return Response.json({ error: "Couldn't write the kitchen card. Try again." }, { status: 500 });
  }
}
