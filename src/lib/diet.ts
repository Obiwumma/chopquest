// A student's meal records, inventory and diet analysis. Plain functions, no DB or network, so the
// numbers are testable and the same everywhere. All protein figures are estimates, not medical advice.
import { DEX_GROUPS } from "./rewards";

export type FoodType = "Plant" | "Alternative" | "Staple" | "Animal";
export type DietItem = { label: string; food: string | null; group: string | null; type: FoodType | null; grams: number; protein: number | null };
export type DietMeal = { id: number; at: string; dish: string | null; total: number; items: DietItem[] };

export type InventorySlot = { group: string; mealCount: number; firstAt: string | null; lastAt: string | null; foods: string[] };
export type DayBar = { date: string; plant: number; alternative: number; animal: number; staple: number; meals: number };
export type Insight = { tone: "good" | "tip" | "info"; title: string; body: string };

export type DietStats = {
  meals: number;
  daysLogged: number;
  avgProteinPerMeal: number;
  plantSharePct: number | null; // plant + alternative protein as a share of all protein-food protein
  completeMealsPct: number;
  groupsThisWeek: number;
  groupsLastWeek: number;
  proteinThisWeek: number;
  proteinLastWeek: number;
  streakDays: number;
  shares: { plant: number; alternative: number; animal: number; staple: number }; // grams, all time
};

export type Diet = { inventory: InventorySlot[]; days: DayBar[]; stats: DietStats; insights: Insight[]; untried: string[] };

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Lagos calendar date (UTC+1) of an ISO time, as YYYY-MM-DD. */
export const lagosDate = (iso: string | number | Date) => new Date(new Date(iso).getTime() + HOUR).toISOString().slice(0, 10);

const LEGUMES = new Set(["Beans", "Bambara", "Pigeon pea", "Groundnut"]);
const GRAIN = /\b(rice|maize|corn|sorghum|millet|wheat|bread|noodles?|spaghetti|pasta)\b/i;
/** Complete protein: any soy, or a grain together with a legume (or any animal protein). */
export function mealIsComplete(m: DietMeal) {
  const groups = new Set(m.items.map((i) => i.group));
  if (groups.has("Soy") || groups.has("Animal")) return true;
  const grain = m.items.some((i) => i.type === "Staple" && GRAIN.test(`${i.food ?? ""} ${i.label}`));
  return grain && [...groups].some((g) => g && LEGUMES.has(g));
}

const proteinGroupsOf = (m: DietMeal) => [...new Set(m.items.map((i) => i.group).filter((g): g is string => !!g && g !== "Staple"))];

export function buildDiet(meals: DietMeal[], now = new Date(), dayCount = 14): Diet {
  const sorted = [...meals].sort((a, b) => (a.at < b.at ? -1 : 1));

  // Inventory: every protein group, with how many meals had it.
  const inventory: InventorySlot[] = DEX_GROUPS.map((group) => {
    const hits = sorted.filter((m) => m.items.some((i) => i.group === group));
    const foods = [...new Set(hits.flatMap((m) => m.items.filter((i) => i.group === group).map((i) => i.label)))];
    return { group, mealCount: hits.length, firstAt: hits[0]?.at ?? null, lastAt: hits.at(-1)?.at ?? null, foods };
  });

  // Daily protein by source for the last `dayCount` Lagos days (today last).
  const today = lagosDate(now);
  const days: DayBar[] = Array.from({ length: dayCount }, (_, k) => {
    const date = lagosDate(new Date(`${today}T12:00:00Z`).getTime() - (dayCount - 1 - k) * DAY);
    return { date, plant: 0, alternative: 0, animal: 0, staple: 0, meals: 0 };
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  const shares = { plant: 0, alternative: 0, animal: 0, staple: 0 };
  for (const m of sorted) {
    const d = byDate.get(lagosDate(m.at));
    if (d) d.meals++;
    for (const i of m.items) {
      const key = i.type === "Plant" ? "plant" : i.type === "Alternative" ? "alternative" : i.type === "Animal" ? "animal" : i.type === "Staple" ? "staple" : null;
      if (!key || i.protein == null) continue;
      shares[key] += i.protein;
      if (d) d[key] += i.protein;
    }
  }
  for (const d of days) for (const k of ["plant", "alternative", "animal", "staple"] as const) d[k] = round1(d[k]);

  // Weeks are the last 7 days and the 7 before, so the comparison is fair on any weekday.
  const t = now.getTime();
  const inRange = (m: DietMeal, from: number, to: number) => {
    const x = new Date(m.at).getTime();
    return x > t - from * DAY && x <= t - to * DAY;
  };
  const thisWeek = sorted.filter((m) => inRange(m, 7, 0));
  const lastWeek = sorted.filter((m) => inRange(m, 14, 7));
  const groupsIn = (ms: DietMeal[]) => new Set(ms.flatMap(proteinGroupsOf)).size;
  const proteinIn = (ms: DietMeal[]) => round1(ms.reduce((s, m) => s + m.total, 0));

  const dates = new Set(sorted.map((m) => lagosDate(m.at)));
  let streakDays = 0;
  // A streak still counts if today has no meal yet but yesterday did.
  for (let k = dates.has(today) ? 0 : 1; dates.has(lagosDate(new Date(`${today}T12:00:00Z`).getTime() - k * DAY)); k++) streakDays++;

  const proteinFoods = shares.plant + shares.alternative + shares.animal;
  const stats: DietStats = {
    meals: sorted.length,
    daysLogged: dates.size,
    avgProteinPerMeal: sorted.length ? round1(sorted.reduce((s, m) => s + m.total, 0) / sorted.length) : 0,
    plantSharePct: proteinFoods > 0 ? Math.round(((shares.plant + shares.alternative) / proteinFoods) * 100) : null,
    completeMealsPct: sorted.length ? Math.round((sorted.filter(mealIsComplete).length / sorted.length) * 100) : 0,
    groupsThisWeek: groupsIn(thisWeek),
    groupsLastWeek: groupsIn(lastWeek),
    proteinThisWeek: proteinIn(thisWeek),
    proteinLastWeek: proteinIn(lastWeek),
    streakDays,
    shares: { plant: round1(shares.plant), alternative: round1(shares.alternative), animal: round1(shares.animal), staple: round1(shares.staple) },
  };

  const untried = inventory.filter((s) => s.mealCount === 0 && s.group !== "Animal").map((s) => s.group);
  return { inventory, days, stats, insights: analyse(stats, inventory, untried), untried };
}

/** Plain-words reading of the numbers. Rules only (no AI), so every sentence traces back to a figure. */
export function analyse(s: DietStats, inventory: InventorySlot[], untried: string[]): Insight[] {
  if (s.meals === 0) return [];
  const out: Insight[] = [];
  const top = [...inventory].filter((x) => x.mealCount > 0).sort((a, b) => b.mealCount - a.mealCount)[0];

  if (s.plantSharePct != null) {
    if (s.plantSharePct >= 60)
      out.push({ tone: "good", title: "Mostly alt protein", body: `About ${s.plantSharePct}% of your protein comes from alt proteins. Keep it up.` });
    else if (s.plantSharePct <= 30)
      out.push({ tone: "tip", title: "Mostly animal protein", body: `Only about ${s.plantSharePct}% of your protein is from alt proteins. Swap one meal this week for moi moi, beans or awara.` });
    else out.push({ tone: "info", title: "A mix of plant and animal", body: `About ${s.plantSharePct}% of your protein is from alt proteins.` });
  }

  if (s.groupsThisWeek >= 4) out.push({ tone: "good", title: "Great variety", body: `${s.groupsThisWeek} different protein groups in the last 7 days.` });
  else if (s.groupsThisWeek <= 1)
    out.push({ tone: "tip", title: "Same protein again", body: `Only ${s.groupsThisWeek} protein group in the last 7 days. Different proteins give your body different building blocks.` });
  if (s.groupsLastWeek > 0 && s.groupsThisWeek !== s.groupsLastWeek)
    out.push({
      tone: s.groupsThisWeek > s.groupsLastWeek ? "good" : "info",
      title: s.groupsThisWeek > s.groupsLastWeek ? "More variety than last week" : "Less variety than last week",
      body: `${s.groupsThisWeek} groups this week against ${s.groupsLastWeek} the week before.`,
    });

  if (s.completeMealsPct >= 60) out.push({ tone: "good", title: "Well paired meals", body: `${s.completeMealsPct}% of your meals had complete protein.` });
  else out.push({ tone: "tip", title: "Pair your plate", body: `${s.completeMealsPct}% of your meals had complete protein. Rice with beans, or anything with soy, fixes that.` });

  if (s.avgProteinPerMeal < 15)
    out.push({ tone: "tip", title: "Light on protein", body: `About ${s.avgProteinPerMeal} g of protein per meal (estimate). Add a wrap of moi moi or a scoop of beans.` });
  else if (s.avgProteinPerMeal >= 25) out.push({ tone: "good", title: "Solid protein per meal", body: `About ${s.avgProteinPerMeal} g of protein per meal (estimate).` });

  if (s.streakDays >= 3) out.push({ tone: "good", title: `${s.streakDays}-day streak`, body: "You've logged a meal every day. Your inventory grows with every scan." });
  if (top) out.push({ tone: "info", title: `Your go-to: ${top.group}`, body: `${top.mealCount} ${top.mealCount === 1 ? "meal" : "meals"}, mostly ${top.foods.slice(0, 3).join(", ")}.` });
  if (untried.length) out.push({ tone: "info", title: "Not tried yet", body: `${untried.slice(0, 4).join(", ")}${untried.length > 4 ? ` and ${untried.length - 4} more` : ""}. Each one fills a new inventory slot.` });
  return out;
}
