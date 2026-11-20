import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertibility, findSwaps } from "./swap";
import { DEFAULT_LIMITS, type DishPart, type Food } from "./types";

// Real protein values from data/protein_db.csv. Prices are TEST VALUES set below, never shipped.
function loadFoods(): Food[] {
  const text = readFileSync(fileURLToPath(new URL("../../data/protein_db.csv", import.meta.url)), "utf8");
  const rows = text.trim().split(/\r?\n/).map(splitCsv);
  const [head, ...data] = rows;
  const col = (n: string) => head.indexOf(n);
  return data.map((r, i) => ({
    id: i + 1,
    food: r[col("food")],
    local_name: r[col("local_name")] || null,
    dex_group: r[col("dex_group")],
    type: r[col("type")] as Food["type"],
    protein_g_per_100g: Number(r[col("protein_g_per_100g")]),
    price_ngn_per_kg: null,
  }));
}
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

const BASE = loadFoods();
const byName = (foods: Food[], name: string) => {
  const f = foods.find((x) => x.food === name);
  if (!f) throw new Error(`no food ${name}`);
  return f;
};
const part = (foods: Food[], name: string, grams: number, role: DishPart["role"]): DishPart => ({
  foodId: byName(foods, name).id, label: name, grams, role,
});

/** Test prices in ₦/kg, applied to a copy of the foods. */
function withPrices(prices: Record<string, number>): Food[] {
  return BASE.map((f) => (f.food in prices ? { ...f, price_ngn_per_kg: prices[f.food] } : { ...f }));
}
const TEST_PRICES = {
  Chicken: 6000,
  "Rice, milled": 1500,
  "Soy chunks (textured soy protein)": 3000,
  "Moi moi": 2500,
  "Beans, boiled": 1200,
  "Soy cheese / Nigerian tofu": 2000,
};

const chickenJollof = (foods: Food[]): DishPart[] => [
  part(foods, "Rice, milled", 100, "staple"), // dry-weight rice, as the CSV stores it
  part(foods, "Chicken", 120, "protein"),
];

describe("findSwaps", () => {
  it("replaces the chicken in jollof and keeps enough protein", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", DEFAULT_LIMITS, foods);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      expect(o.replaces.map((p) => p.label)).toEqual(["Chicken"]);
      expect(o.after.proteinG / o.before.proteinG).toBeGreaterThanOrEqual(0.8);
      expect(o.adds.every((a) => byName(foods, foods.find((f) => f.id === a.foodId)!.food).type !== "Animal")).toBe(true);
    }
  });

  it("returns at most 3 options, ranked 1-2-3, best score first, each with a different main protein", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", DEFAULT_LIMITS, foods);
    expect(opts.length).toBeLessThanOrEqual(3);
    expect(opts.map((o) => o.rank)).toEqual([1, 2, 3].slice(0, opts.length));
    for (let i = 1; i < opts.length; i++) expect(opts[i - 1].score).toBeGreaterThanOrEqual(opts[i].score);
    const mains = opts.map((o) => {
      const top = [...o.adds].sort((a, b) => b.grams - a.grams)[0];
      return foods.find((f) => f.id === top.foodId)!.dex_group;
    });
    expect(new Set(mains).size).toBe(mains.length);
  });

  it("only suggests foods that fit the dish when keepDishIdentity is on", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", DEFAULT_LIMITS, foods);
    const allowed = new Set(["Soy chunks (textured soy protein)", "Moi moi", "Beans, boiled", "Soy cheese / Nigerian tofu"]);
    for (const o of opts) for (const a of o.adds) expect(allowed.has(foods.find((f) => f.id === a.foodId)!.food)).toBe(true);
  });

  it("explains every option: the reasons add up to the score", () => {
    const foods = withPrices(TEST_PRICES);
    for (const o of findSwaps(chickenJollof(foods), "Chicken jollof rice", DEFAULT_LIMITS, foods)) {
      expect(o.reasons.reduce((s, r) => s + r.points, 0)).toBe(o.score);
      expect(o.score).toBeLessThanOrEqual(100);
    }
  });

  it("computes costs from prices and respects the max cost per plate", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", { ...DEFAULT_LIMITS, maxCostPerPlateNgn: 700 }, foods);
    // before: rice 100 g × ₦1500/kg = 150, chicken 120 g × ₦6000/kg = 720 → 870
    for (const o of opts) {
      expect(o.before.costNgn).toBe(870);
      expect(o.after.costNgn).not.toBeNull();
      expect(o.after.costNgn!).toBeLessThanOrEqual(700);
    }
  });

  it("never guesses a price: cost is null and listed as missing when we have no price", () => {
    const foods = withPrices({}); // no prices at all
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", DEFAULT_LIMITS, foods);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      expect(o.before.costNgn).toBeNull();
      expect(o.after.costNgn).toBeNull();
      expect(o.priceMissing).toContain("Chicken");
      expect(o.reasons.find((r) => r.factor === "Cost per plate")!.points).toBe(0);
    }
  });

  it("respects the extra prep limit", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", { ...DEFAULT_LIMITS, maxExtraPrepMin: 0 }, foods);
    for (const o of opts) expect(o.extraPrepMin).toBe(0);
    // soy chunks need soaking (15 min), so they can't appear
    for (const o of opts) for (const a of o.adds) expect(foods.find((f) => f.id === a.foodId)!.food).not.toBe("Soy chunks (textured soy protein)");
  });

  it("returns nothing for a dish with no animal protein", () => {
    const foods = withPrices(TEST_PRICES);
    const dish = [part(foods, "Rice, milled", 100, "staple"), part(foods, "Beans, boiled", 150, "protein")];
    expect(findSwaps(dish, "Rice and beans", DEFAULT_LIMITS, foods)).toEqual([]);
  });

  it("returns nothing when the protein target can't be reached", () => {
    const foods = withPrices(TEST_PRICES);
    const opts = findSwaps(chickenJollof(foods), "Chicken jollof rice", { ...DEFAULT_LIMITS, minProteinKeptPct: 500 }, foods);
    expect(opts).toEqual([]);
  });

  it("ignores parts the AI couldn't match (foodId null) and still prices the swap", () => {
    const foods = withPrices(TEST_PRICES);
    const dish = [...chickenJollof(foods), { foodId: null, label: "Mystery sauce", grams: 50, role: "soup" as const }];
    const opts = findSwaps(dish, "Chicken jollof rice", DEFAULT_LIMITS, foods);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].before.costNgn).toBe(870); // the unmatched sauce is the same on both plates
    expect(opts[0].after.costNgn).not.toBeNull();
  });
});

describe("convertibility", () => {
  it("rates chicken jollof as convertible and a dish without a breakdown as hard", () => {
    const foods = withPrices(TEST_PRICES);
    expect(["easy", "medium"]).toContain(convertibility(chickenJollof(foods), "Chicken jollof rice", foods));
    expect(convertibility(null, "Chicken jollof rice", foods)).toBe("hard");
  });
});
