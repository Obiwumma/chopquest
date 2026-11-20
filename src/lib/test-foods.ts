// Test helper: the real foods from data/protein_db.csv (protein + basis), with optional test prices.
// Only imported by *.test.ts files and scripts; never by the app.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Food } from "./types";

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function loadFoods(prices: Record<string, number> = {}): Food[] {
  // Scripts and tests run from the project root.
  const text = readFileSync(resolve(process.cwd(), "data/protein_db.csv"), "utf8");
  const [head, ...rows] = text.trim().split(/\r?\n/).map(splitCsv);
  const col = (n: string) => head.indexOf(n);
  return rows.map((r, i) => ({
    id: i + 1,
    food: r[col("food")],
    local_name: r[col("local_name")] || null,
    dex_group: r[col("dex_group")],
    type: r[col("type")] as Food["type"],
    protein_g_per_100g: Number(r[col("protein_g_per_100g")]),
    price_ngn_per_kg: prices[r[col("food")]] ?? null,
    basis: r[col("basis")] || null,
  }));
}

export const foodByName = (foods: Food[], name: string): Food => {
  const f = foods.find((x) => x.food === name);
  if (!f) throw new Error(`no food ${name}`);
  return f;
};
