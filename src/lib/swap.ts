// The swap engine: takes the meat out of a dish and finds the best plant-based replacements.
// A plain function with no database or network, so the offline /demo can run it in the browser.
// Owner: Marv. Scoring rules are documented in team/marv-backend.md.
import { ADDONS, DEFAULT_PREP_MIN, SERVING_G, addonsFor, type AddonMap } from "./addons";
import type { Convertibility, DishPart, Food, SwapAdd, SwapLimits, SwapOption, SwapReason } from "./types";
import { DEFAULT_LIMITS } from "./types";

const LEGUME_GROUPS = new Set(["Beans", "Bambara", "Pigeon pea", "Groundnut"]);
const GRAIN = /\b(rice|maize|corn|sorghum|millet|wheat|bread|noodles?|spaghetti|pasta)\b/i;
const PORTIONS = [0.5, 1, 1.5, 2];
const PAIR_PORTIONS: [number, number][] = [
  [1, 1],
  [1, 0.5],
  [0.5, 1],
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const proteinOf = (f: Food, grams: number) => (grams * f.protein_g_per_100g) / 100;
const costOf = (f: Food, grams: number) => (f.price_ngn_per_kg == null ? null : (grams * f.price_ngn_per_kg) / 1000);

type Candidate = { adds: { food: Food; grams: number }[] };

/** Sum of costs, or null when any one is unknown (we never guess a price). */
function sumCost(values: (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v == null) return null;
    total += v;
  }
  return total;
}

function isGrain(f: Food) {
  return f.type === "Staple" && GRAIN.test(`${f.food} ${f.local_name ?? ""}`);
}

/** Plant-only plate is complete when it has soy, or a grain together with a legume. */
function isComplete(foods: Food[]) {
  if (foods.some((f) => f.dex_group === "Soy")) return true;
  return foods.some(isGrain) && foods.some((f) => LEGUME_GROUPS.has(f.dex_group));
}

/**
 * Top 3 plant-based swaps for a dish, best first, each with a different main protein.
 * Returns [] when the dish has no animal protein to replace or nothing passes the limits.
 */
export function findSwaps(
  breakdown: DishPart[],
  dishName: string,
  limits: SwapLimits = DEFAULT_LIMITS,
  foods: Food[],
  addons: AddonMap = ADDONS,
): SwapOption[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const parts = breakdown.map((p) => ({ part: p, food: p.foodId == null ? undefined : byId.get(p.foodId) }));

  const meat = parts.filter((x) => x.food?.type === "Animal");
  if (!meat.length) return [];
  const staying = parts.filter((x) => x.food?.type !== "Animal");

  const beforeProtein = parts.reduce((s, x) => s + (x.food ? proteinOf(x.food, x.part.grams) : 0), 0);
  if (beforeProtein <= 0) return [];
  const meatCost = sumCost(meat.map((x) => costOf(x.food!, x.part.grams)));
  const stayingProtein = staying.reduce((s, x) => s + (x.food ? proteinOf(x.food, x.part.grams) : 0), 0);
  // Parts the AI couldn't match (e.g. "tomato stew") are identical before and after the swap, so they
  // are left out of both totals: the cost change stays exact instead of becoming "unknown".
  const stayingCost = sumCost(staying.filter((x) => x.food).map((x) => costOf(x.food!, x.part.grams)));
  const beforeCost = meatCost != null && stayingCost != null ? meatCost + stayingCost : null;
  const stayingFoods = staying.map((x) => x.food).filter((f): f is Food => Boolean(f));

  const fits = addonsFor(dishName, addons);
  const pool = foods.filter(
    (f) =>
      (f.type === "Plant" || f.type === "Alternative") &&
      SERVING_G[f.food] != null &&
      (!limits.keepDishIdentity || fits.has(f.food)),
  );

  const candidates: Candidate[] = [];
  for (const f of pool) for (const m of PORTIONS) candidates.push({ adds: [{ food: f, grams: SERVING_G[f.food] * m }] });
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].dex_group === pool[j].dex_group) continue;
      for (const [a, b] of PAIR_PORTIONS)
        candidates.push({
          adds: [
            { food: pool[i], grams: SERVING_G[pool[i].food] * a },
            { food: pool[j], grams: SERVING_G[pool[j].food] * b },
          ],
        });
    }

  const scored: (SwapOption & { mainGroup: string })[] = [];
  for (const c of candidates) {
    const addProtein = c.adds.reduce((s, a) => s + proteinOf(a.food, a.grams), 0);
    const afterProtein = stayingProtein + addProtein;
    const kept = afterProtein / beforeProtein;
    if (kept * 100 < limits.minProteinKeptPct) continue;

    const addCost = sumCost(c.adds.map((a) => costOf(a.food, a.grams)));
    const afterCost = addCost != null && stayingCost != null ? addCost + stayingCost : null;
    if (limits.maxCostPerPlateNgn != null && afterCost != null && afterCost > limits.maxCostPerPlateNgn) continue;

    const prep = c.adds.reduce((s, a) => s + (fits.get(a.food.food)?.extraPrepMin ?? DEFAULT_PREP_MIN[a.food.food] ?? 0), 0);
    if (prep > limits.maxExtraPrepMin) continue;

    const complete = isComplete([...stayingFoods, ...c.adds.map((a) => a.food)]);
    const priceMissing = [
      ...new Set([...c.adds.map((a) => a.food), ...meat.map((x) => x.food!)].filter((f) => f.price_ngn_per_kg == null).map((f) => f.food)),
    ];

    const reasons: SwapReason[] = [];
    // Protein kept: full marks from 100% kept, none at 50% or below. Overshooting earns nothing extra.
    const pProtein = Math.round(30 * clamp01((kept - 0.5) / 0.5));
    reasons.push({ factor: "Protein kept", points: pProtein, note: `${Math.round(kept * 100)}% of the original protein (estimate)` });

    let pCost = 0;
    if (meatCost != null && addCost != null && meatCost > 0) {
      const saving = (meatCost - addCost) / meatCost;
      pCost = Math.round(25 * clamp01(saving));
      reasons.push({
        factor: "Cost per plate",
        points: pCost,
        note: saving >= 0 ? `₦${Math.round(meatCost - addCost)} cheaper than the meat it replaces` : `₦${Math.round(addCost - meatCost)} more than the meat it replaces`,
      });
    } else {
      reasons.push({ factor: "Cost per plate", points: 0, note: "price coming: not scored yet" });
    }

    const strengths: number[] = c.adds.map((a) => fits.get(a.food.food)?.strength ?? 0);
    const pFit = Math.round((20 * strengths.reduce((s, x) => s + x, 0)) / (3 * strengths.length));
    reasons.push({ factor: "Fits the dish", points: pFit, note: pFit >= 14 ? "a common pairing for this dish" : pFit > 0 ? "works with this dish" : "not a usual pairing" });

    const pComplete = complete ? 10 : 0;
    reasons.push({ factor: "Complete protein", points: pComplete, note: complete ? "all essential amino acids on the plate" : "add a grain or legume to complete it" });

    const pPrep = Math.round(10 * clamp01(1 - prep / 30));
    reasons.push({ factor: "Kitchen effort", points: pPrep, note: prep === 0 ? "no extra prep" : `about ${prep} min extra prep` });

    const pPrice = priceMissing.length === 0 ? 5 : 0;
    reasons.push({ factor: "Prices confirmed", points: pPrice, note: pPrice ? "all prices from our market survey" : `price coming for ${priceMissing.join(", ")}` });

    const adds: SwapAdd[] = c.adds.map((a) => ({ foodId: a.food.id, label: a.food.local_name ?? a.food.food, grams: round1(a.grams) }));
    const main = [...c.adds].sort((a, b) => proteinOf(b.food, b.grams) - proteinOf(a.food, a.grams))[0].food;

    scored.push({
      rank: 1,
      replaces: meat.map((x) => x.part),
      adds,
      before: { proteinG: round1(beforeProtein), costNgn: beforeCost == null ? null : Math.round(beforeCost) },
      after: { proteinG: round1(afterProtein), costNgn: afterCost == null ? null : Math.round(afterCost) },
      completeProtein: complete,
      extraPrepMin: prep,
      score: pProtein + pCost + pFit + pComplete + pPrep + pPrice,
      reasons,
      priceMissing,
      mainGroup: main.dex_group,
    });
  }

  // Best first; ties go to the simpler swap (fewer foods), then to less food on the plate.
  scored.sort((a, b) => b.score - a.score || a.adds.length - b.adds.length || totalGrams(a) - totalGrams(b));

  const picked: SwapOption[] = [];
  const usedGroups = new Set<string>();
  for (const s of scored) {
    if (usedGroups.has(s.mainGroup)) continue;
    usedGroups.add(s.mainGroup);
    const { mainGroup: _mainGroup, ...option } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
    picked.push({ ...option, rank: (picked.length + 1) as 1 | 2 | 3 });
    if (picked.length === 3) break;
  }
  return picked;
}

const totalGrams = (o: SwapOption) => o.adds.reduce((s, a) => s + a.grams, 0);

/** How easy a dish is to convert, for the menu board: easy (best swap scores 70+), medium (40 to 69), hard. */
export function convertibility(breakdown: DishPart[] | null, dishName: string, foods: Food[]): Convertibility {
  if (!breakdown?.length) return "hard";
  const best = findSwaps(breakdown, dishName, DEFAULT_LIMITS, foods)[0];
  if (!best) return "hard";
  return best.score >= 70 ? "easy" : best.score >= 40 ? "medium" : "hard";
}
