// Ask the AI to break down every menu item that has no breakdown yet, and save the answers.
// Run this the night before the pitch so the live demo reads from the database, not from credits.
//   npm run ai:precompute            -> only dishes without a breakdown
//   npm run ai:precompute -- --all   -> redo every dish (answers are still cached by input)
import "./lib/env.mjs";
import { query } from "@/lib/db";
import { listFoods } from "@/lib/foods-db";
import { aiJson, AiError } from "@/lib/ai/client";
import { breakdownDish } from "@/lib/ai/breakdown";
import { cachedAiJson, cacheKey } from "@/lib/server/ai-cache";
import { saveBreakdown } from "@/lib/server/cafeterias";

const all = process.argv.includes("--all");
const items = await query<{ id: number; name: string; price_ngn: number; cafeteria: string; breakdown: string | null }>(
  `SELECT m.id, m.name, m.price_ngn, c.name AS cafeteria, m.breakdown
   FROM menu_items m JOIN cafeterias c ON c.id = m.cafeteria_id ORDER BY c.name, m.name`,
);
const todo = items.filter((i) => all || !i.breakdown);
console.log(`${items.length} menu items, ${todo.length} to break down.`);
const foods = await listFoods();

let done = 0;
let fromCache = 0;
const failed: string[] = [];
for (const item of todo) {
  try {
    let cached = true;
    const parts = await breakdownDish({ menuItemName: item.name, cafeteria: item.cafeteria, priceNgn: item.price_ngn }, foods, async (req) => {
      const out = await cachedAiJson(cacheKey("breakdown", { name: item.name, price: item.price_ngn, cafeteria: item.cafeteria, photo: null }), () => aiJson(req));
      cached = out.cached;
      return out;
    });
    if (!parts.length) {
      failed.push(`${item.cafeteria} / ${item.name}: no parts`);
      continue;
    }
    await saveBreakdown(item.id, parts.map(({ foodId, label, grams, role }) => ({ foodId, label, grams, role })));
    done++;
    if (cached) fromCache++;
    const unmatched = parts.filter((p) => p.foodId == null).map((p) => p.label);
    console.log(`ok  ${item.cafeteria} / ${item.name}: ${parts.map((p) => `${p.label} ${p.grams}g`).join(", ")}${unmatched.length ? `  (check: ${unmatched.join(", ")})` : ""}`);
  } catch (e) {
    failed.push(`${item.cafeteria} / ${item.name}: ${(e as Error).message}`);
    if (e instanceof AiError && (e.kind === "credits" || e.kind === "config" || e.kind === "rate_limit")) {
      console.error(`Stopping: ${e.message}`);
      break;
    }
  }
}
console.log(`\nSaved ${done} breakdowns (${fromCache} from cache). Failed: ${failed.length}`);
for (const f of failed) console.log(`  - ${f}`);
console.log("Managers can fix any part on the dish screen; their fix replaces the AI's.");
