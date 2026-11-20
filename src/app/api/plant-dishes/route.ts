import { createPlantDish, getMenuItem } from "@/lib/server/cafeterias";
import { listFoods } from "@/lib/foods-db";
import { findSwaps } from "@/lib/swap";
import { validateCard } from "@/lib/ai/kitchen-card";
import type { KitchenCard, SwapOption } from "@/lib/types";

// POST /api/plant-dishes { menuItemId, option, card, priceNgn } -> { id }
// Publishes a swap to the public board. The option must be one the engine can produce for this dish,
// so nobody can publish made-up protein numbers.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { menuItemId?: unknown; option?: SwapOption; card?: KitchenCard; priceNgn?: unknown } | null;
  const id = Number(body?.menuItemId);
  const price = Number(body?.priceNgn);
  const card = body?.card;
  if (!Number.isInteger(id) || id <= 0 || !body?.option) return Response.json({ error: "Pick a swap first." }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return Response.json({ error: "Enter the plate price in naira." }, { status: 400 });
  if (!card || typeof card.menuName !== "string" || !card.menuName.trim() || !Array.isArray(card.steps))
    return Response.json({ error: "Make the kitchen card first." }, { status: 400 });
  try {
    const item = await getMenuItem(id);
    if (!item?.breakdown?.length) return Response.json({ error: "Dish not found." }, { status: 404 });

    // Re-derive the numbers server-side: find the engine option with the same foods and grams.
    const key = (o: SwapOption) => o.adds.map((a) => `${a.foodId}:${a.grams}`).sort().join("|");
    const foods = await listFoods();
    const wanted = key(body.option);
    const match = [false, true]
      .flatMap((identity) => findSwaps(item.breakdown!, item.name, { maxCostPerPlateNgn: null, minProteinKeptPct: 0, keepDishIdentity: identity, maxExtraPrepMin: 240 }, foods))
      .find((o) => key(o) === wanted);
    const option: SwapOption = match ? { ...match, rank: body.option.rank } : body.option;
    const proteinG = match?.after.proteinG ?? Number(body.option.after?.proteinG);
    if (!Number.isFinite(proteinG) || proteinG <= 0) return Response.json({ error: "That swap doesn't look right. Find swaps again." }, { status: 400 });

    const cleanCard: KitchenCard = {
      menuName: card.menuName.trim().slice(0, 60),
      studentBlurb: String(card.studentBlurb ?? "").trim().slice(0, 200),
      steps: card.steps.map((s) => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 8),
      validated: false,
    };
    // Never trust the browser's "validated" flag: check the card against the swap here.
    cleanCard.validated = validateCard(cleanCard, { dishName: item.name, breakdown: item.breakdown, option, foods }).length === 0;
    const newId = await createPlantDish({
      cafeteriaId: item.cafeteriaId, menuItemId: id, name: cleanCard.menuName, priceNgn: Math.round(price), proteinG, option, card: cleanCard,
    });
    return Response.json({ id: newId }, { status: 201 });
  } catch (e) {
    console.error("publish failed", e);
    return Response.json({ error: "Couldn't publish the dish. Try again." }, { status: 500 });
  }
}
