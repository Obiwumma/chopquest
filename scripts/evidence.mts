// Evidence numbers for the pitch: run the swap engine over every menu item we have, and summarise
// the public board. Uses only real data in the database; nothing is invented.
//   npm run evidence            -> default limits (keep 80% protein, same dish, max 15 min prep)
//   npm run evidence -- --budget   also requires the swapped plate to cost no more than before
// Writes team/evidence/swap-evidence.md.
import "./lib/env.mjs";
import { query } from "@/lib/db";
import { listFoods } from "@/lib/foods-db";
import { findSwaps } from "@/lib/swap";
import { DEFAULT_LIMITS, type DishPart } from "@/lib/types";
import { avg, fmt, pct, writeReport } from "./lib/env.mjs";

const budget = process.argv.includes("--budget");
const foods = await listFoods();
const items = await query<{ id: number; name: string; price_ngn: number; cafeteria: string; breakdown: string | null }>(
  `SELECT m.id, m.name, m.price_ngn, c.name AS cafeteria, m.breakdown FROM menu_items m JOIN cafeterias c ON c.id = m.cafeteria_id ORDER BY c.name, m.name`,
);
const byId = new Map(foods.map((f) => [f.id, f]));

let withMeat = 0, withSwap = 0, complete = 0, pricedPairs = 0, noBreakdown = 0;
const kept: number[] = [], costChange: number[] = [], costChangePct: number[] = [], scores: number[] = [];
const rows: string[] = [];
const perCafe = new Map<string, { dishes: number; swaps: number }>();

for (const it of items) {
  const c = perCafe.get(it.cafeteria) ?? { dishes: 0, swaps: 0 };
  c.dishes++;
  perCafe.set(it.cafeteria, c);
  const parts: DishPart[] | null = it.breakdown ? JSON.parse(it.breakdown) : null;
  if (!parts?.length) { noBreakdown++; rows.push(`| ${it.cafeteria} | ${it.name} | no breakdown yet | | | |`); continue; }
  if (!parts.some((p) => p.foodId != null && byId.get(p.foodId)?.type === "Animal")) { rows.push(`| ${it.cafeteria} | ${it.name} | already meat-free | | | |`); continue; }
  withMeat++;
  const opts = findSwaps(parts, it.name, DEFAULT_LIMITS, foods);
  const best = budget ? opts.find((o) => o.before.costNgn != null && o.after.costNgn != null && o.after.costNgn <= o.before.costNgn) : opts[0];
  if (!best) { rows.push(`| ${it.cafeteria} | ${it.name} | no swap within limits | | | |`); continue; }
  withSwap++;
  c.swaps++;
  scores.push(best.score);
  kept.push(best.after.proteinG / best.before.proteinG);
  if (best.completeProtein) complete++;
  let cost = "price coming";
  if (best.before.costNgn != null && best.after.costNgn != null) {
    pricedPairs++;
    costChange.push(best.after.costNgn - best.before.costNgn);
    costChangePct.push((best.after.costNgn - best.before.costNgn) / best.before.costNgn);
    cost = `₦${best.before.costNgn} → ₦${best.after.costNgn}`;
  }
  rows.push(`| ${it.cafeteria} | ${it.name} | ${best.adds.map((a) => `${a.label} ${a.grams} g`).join(" + ")} | ${fmt(best.before.proteinG)} → ${fmt(best.after.proteinG)} g | ${cost} | ${best.score} |`);
}

const board = await query<{ dishes: number; reviews: number; avg_stars: number | null; woa: number | null }>(
  `SELECT (SELECT COUNT(*) FROM plant_dishes) AS dishes, COUNT(r.id) AS reviews, AVG(r.stars) AS avg_stars, AVG(r.would_order_again) AS woa FROM reviews r`,
);
const b = board[0];

let md = `# Swap evidence\n\nRun ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. Limits: keep ≥ ${DEFAULT_LIMITS.minProteinKeptPct}% protein, same dish, ≤ ${DEFAULT_LIMITS.maxExtraPrepMin} min extra prep${budget ? ", plate cost no higher than before" : ""}.\nProtein and cost are estimates from our food table and market survey prices.\n\n`;
md += `## Headline numbers\n\n| Measure | Result |\n|---|---|\n`;
md += `| Menu items collected | ${items.length} (across ${perCafe.size} cafeterias) |\n`;
md += `| Items with a breakdown | ${items.length - noBreakdown} |\n`;
md += `| Items containing meat, fish or egg | ${withMeat} |\n`;
md += `| ...with a plant swap that passes the limits | ${withSwap} (${pct(withSwap, withMeat)}) |\n`;
md += `| Average protein kept by the best swap | ${pct(avg(kept) * 100, 100)} |\n`;
md += `| Best swaps that are complete proteins | ${pct(complete, withSwap)} |\n`;
md += `| Average change in ingredient cost per plate | ${pricedPairs ? `₦${fmt(avg(costChange), 0)} (${pct(avg(costChangePct) * 100, 100)}), from ${pricedPairs} fully priced dishes` : "price coming"} |\n`;
md += `| Average swap score | ${fmt(avg(scores), 0)} / 100 |\n`;
md += `| Plant dishes published / student reviews | ${b?.dishes ?? 0} / ${b?.reviews ?? 0} |\n`;
md += `| Average rating / would order again | ${b?.avg_stars == null ? "no reviews yet" : `${fmt(b.avg_stars)} stars / ${pct((b.woa ?? 0) * 100, 100)}`} |\n`;
md += `\n## Per cafeteria\n\n| Cafeteria | Dishes | With a swap |\n|---|---|---|\n${[...perCafe].map(([n, c]) => `| ${n} | ${c.dishes} | ${c.swaps} |`).join("\n")}\n`;
md += `\n## Every dish\n\n| Cafeteria | Dish | Best swap | Protein | Ingredient cost | Score |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
md += `\n_Limits: protein from table values, portions estimated by AI and corrected by managers, prices from a ${new Date().getFullYear()} campus survey, taste not tested, not medical advice._\n`;
await writeReport("swap-evidence.md", md);
console.log(md.split("## Per cafeteria")[0]);
