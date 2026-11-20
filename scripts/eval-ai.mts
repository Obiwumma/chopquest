// AI accuracy test: our evidence slide for "AI contribution" and "evidence & technical quality".
// Compares the AI breakdown against Jason's hand-weighed dishes (team/market-survey/eval-dishes.csv)
// and checks how often the kitchen card passes the validator first time.
//   npm run eval                                   -> uses OPENROUTER_MODEL
//   npm run eval -- --models anthropic/claude-haiku-5.5,anthropic/claude-sonnet-4.6   -> compares models
// Writes team/evidence/ai-accuracy.md. Report the real numbers, even when they're bad.
import "./lib/env.mjs";
import { existsSync, readFileSync } from "node:fs";
import { aiJson, DEFAULT_MODEL, type AiJsonResult } from "@/lib/ai/client";
import { breakdownDish } from "@/lib/ai/breakdown";
import { writeKitchenCard } from "@/lib/ai/kitchen-card";
import { matchFood } from "@/lib/match";
import { findSwaps } from "@/lib/swap";
import { DEFAULT_LIMITS, type DishPart, type Food } from "@/lib/types";
import { loadFoods } from "@/lib/test-foods";
import { avg, fmt, pct, writeReport } from "./lib/env.mjs";

const CSV = "team/market-survey/eval-dishes.csv";
if (!existsSync(CSV)) {
  console.error(`${CSV} not found. Merge the team plan (PR #7) and fill it in first.`);
  process.exit(1);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((f) => f.trim())) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const [head, ...data] = rows;
  return data.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const foods: Food[] = loadFoods();
const byId = new Map(foods.map((f) => [f.id, f]));
const protein = (parts: DishPart[]) => parts.reduce((s, p) => s + (p.foodId ? ((byId.get(p.foodId)?.protein_g_per_100g ?? 0) * p.grams) / 100 : 0), 0);

// Group Jason's rows into dishes.
type Dish = { cafeteria: string; name: string; price: number; truth: DishPart[] };
const dishes = new Map<string, Dish>();
for (const r of parseCsv(readFileSync(CSV, "utf8"))) {
  if (!r.dish_name || !r.part) continue;
  const key = `${r.cafeteria}|${r.dish_name}`;
  const d = dishes.get(key) ?? { cafeteria: r.cafeteria, name: r.dish_name, price: Number(r.price_ngn) || 0, truth: [] };
  const food = foods.find((f) => f.food === r.food_in_our_database) ?? matchFood(r.part, null, foods);
  const grams = Number(r.grams);
  if (Number.isFinite(grams) && grams > 0) d.truth.push({ foodId: food?.id ?? null, label: r.part, grams, role: food?.type === "Animal" ? "protein" : "side" });
  dishes.set(key, d);
}
const list = [...dishes.values()].filter((d) => d.truth.length);
if (!list.length) {
  console.error(`No dishes with weighed parts in ${CSV} yet.`);
  process.exit(1);
}

const argModels = process.argv.find((a) => a.startsWith("--models"))?.split("=")[1] ?? process.argv[process.argv.indexOf("--models") + 1];
const models = process.argv.includes("--models") || argModels?.includes("/") ? (argModels ?? "").split(",").filter(Boolean) : [process.env.OPENROUTER_MODEL || DEFAULT_MODEL];

type ModelResult = { model: string; partRecall: number[]; proteinErrG: number[]; proteinErrPct: number[]; cardFirst: number; cardRetry: number; cardTemplate: number; costUsd: number; tokens: number; failed: number; rows: string[] };
const results: ModelResult[] = [];

for (const model of models) {
  process.env.OPENROUTER_MODEL = model;
  const r: ModelResult = { model, partRecall: [], proteinErrG: [], proteinErrPct: [], cardFirst: 0, cardRetry: 0, cardTemplate: 0, costUsd: 0, tokens: 0, failed: 0, rows: [] };
  const ask = async (req: Parameters<typeof aiJson>[0]): Promise<AiJsonResult> => {
    const out = await aiJson(req);
    r.costUsd += out.usage.costUsd ?? 0;
    r.tokens += out.usage.promptTokens + out.usage.completionTokens;
    return out;
  };
  console.log(`\n== ${model} ==`);
  for (const d of list) {
    try {
      const ai = await breakdownDish({ menuItemName: d.name, cafeteria: d.cafeteria, priceNgn: d.price }, foods, ask);
      const truthIds = new Set(d.truth.map((p) => p.foodId).filter((x): x is number => x != null));
      const aiIds = new Set(ai.map((p) => p.foodId).filter((x): x is number => x != null));
      const found = [...truthIds].filter((x) => aiIds.has(x)).length;
      const recall = truthIds.size ? found / truthIds.size : 0;
      const pTrue = protein(d.truth);
      const pAi = protein(ai);
      r.partRecall.push(recall);
      r.proteinErrG.push(Math.abs(pAi - pTrue));
      if (pTrue > 0) r.proteinErrPct.push(Math.abs(pAi - pTrue) / pTrue);

      const option = findSwaps(d.truth, d.name, DEFAULT_LIMITS, foods)[0];
      let card = "no swap";
      if (option) {
        const out = await writeKitchenCard({ dishName: d.name, breakdown: d.truth, option, foods }, ask);
        card = out.source;
        if (out.source === "ai") r.cardFirst++;
        else if (out.source === "ai-retry") r.cardRetry++;
        else r.cardTemplate++;
      }
      r.rows.push(`| ${d.cafeteria} | ${d.name} | ${found}/${truthIds.size} | ${fmt(pTrue)} | ${fmt(pAi)} | ${card} |`);
      console.log(`${d.name}: parts ${found}/${truthIds.size}, protein true ${fmt(pTrue)} g vs AI ${fmt(pAi)} g, card ${card}`);
    } catch (e) {
      r.failed++;
      r.rows.push(`| ${d.cafeteria} | ${d.name} | failed | | | ${(e as Error).message.slice(0, 60)} |`);
      console.log(`${d.name}: FAILED ${(e as Error).message}`);
    }
  }
  results.push(r);
}

const cards = (r: ModelResult) => r.cardFirst + r.cardRetry + r.cardTemplate;
let md = `# AI accuracy test\n\nRun ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC on ${list.length} hand-weighed dishes from \`${CSV}\`.\nProtein uses our food table (estimates). Truth = Jason's weighed breakdown.\n\n`;
md += `| Model | Parts found | Avg protein error | Kitchen card valid first time | After one retry | Fell back to template | Failed calls | Tokens | Cost (USD) |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results)
  md += `| ${r.model} | ${pct(avg(r.partRecall) * 100, 100)} | ${fmt(avg(r.proteinErrG))} g (${pct(avg(r.proteinErrPct) * 100, 100)}) | ${pct(r.cardFirst, cards(r))} | ${pct(r.cardRetry, cards(r))} | ${pct(r.cardTemplate, cards(r))} | ${r.failed} | ${r.tokens} | ${r.costUsd.toFixed(4)} |\n`;
for (const r of results)
  md += `\n## ${r.model}\n\n| Cafeteria | Dish | Parts found | Protein true (g) | Protein AI (g) | Kitchen card |\n|---|---|---|---|---|---|\n${r.rows.join("\n")}\n`;
md += `\n_Limits: small sample, portions vary by plate, protein values are table estimates, taste not tested._\n`;
await writeReport("ai-accuracy.md", md);
