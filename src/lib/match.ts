import type { Food } from "./foods";

// Dish names the AI uses -> the `food` row they should count as. Keys are normalised (see norm()).
// Hand-written because the vision model speaks in dishes and the DB speaks in ingredients.
const ALIASES: Record<string, string> = {
  "jollof rice": "Rice, milled",
  "jollof": "Rice, milled",
  "fried rice": "Rice, milled",
  "white rice": "Rice, milled",
  "ofada rice": "Rice, milled",
  "coconut rice": "Rice, milled",
  "rice": "Rice, milled",
  "dodo": "Plantain, ripe",
  "fried plantain": "Plantain, ripe",
  "plantain": "Plantain, ripe",
  "boli": "Plantain, ripe",
  "eba": "Cassava meal",
  "garri": "Cassava meal",
  "gari": "Cassava meal",
  "fufu": "Cassava meal",
  "pounded yam": "Yam, fresh",
  "iyan": "Yam, fresh",
  "amala": "Yam, fresh",
  "boiled yam": "Yam, fresh",
  "yam porridge": "Yam, fresh",
  "asaro": "Yam, fresh",
  "yam": "Yam, fresh",
  "bread": "Wheat flour (bread)",
  "agege bread": "Wheat flour (bread)",
  "toast": "Wheat flour (bread)",
  "semo": "Wheat flour (bread)",
  "semovita": "Wheat flour (bread)",
  "spaghetti": "Wheat flour (bread)",
  "indomie": "Instant noodles, dry",
  "noodles": "Instant noodles, dry",
  "tuwo": "Maize, dried",
  "tuwo masara": "Maize, dried",
  "pap": "Maize, dried",
  "ogi": "Maize, dried",
  "akamu": "Maize, dried",
  "corn": "Maize, dried",
  "tuwo shinkafa": "Rice, milled",
  "fura": "Millet",
  "ewa agoyin": "Beans, boiled",
  "agoyin": "Beans, boiled",
  "beans": "Beans, boiled",
  "boiled beans": "Beans, boiled",
  "stewed beans": "Beans, boiled",
  "beans porridge": "Beans porridge",
  "ewa riro": "Beans porridge",
  "moi moi": "Moi moi",
  "moin moin": "Moi moi",
  "moimoi": "Moi moi",
  "akara": "Akara",
  "bean cake": "Akara",
  "okpa": "Okpa (steamed bambara pudding)",
  "awara": "Soy cheese / Nigerian tofu",
  "wara": "Soy cheese / Nigerian tofu",
  "tofu": "Soy cheese / Nigerian tofu",
  "soy chunks": "Soy chunks (textured soy protein)",
  "soya chunks": "Soy chunks (textured soy protein)",
  "kuli kuli": "Kuli-kuli (groundnut cake)",
  "groundnut": "Groundnuts, dry",
  "groundnuts": "Groundnuts, dry",
  "peanuts": "Groundnuts, dry",
  "roasted groundnut": "Groundnuts, dry",
  "peanut butter": "Groundnut paste",
  "groundnut soup": "Groundnut paste",
  "egusi": "Egusi soup (no meat)",
  "egusi soup": "Egusi soup (no meat)",
  "iru": "Fermented locust bean",
  "dawadawa": "Fermented locust bean",
  "ogiri": "Fermented locust bean",
  "mushroom": "Oyster mushroom, fresh",
  "mushrooms": "Oyster mushroom, fresh",
  "kunun aya": "Tigernut drink",
  "tigernut": "Tigernut, dried",
  "tiger nut": "Tigernut, dried",
  "fiofio": "Pigeon pea, dried",
  "pigeon peas": "Pigeon pea, dried",
  "suya": "Beef (incl. suya)",
  "kilishi": "Beef (incl. suya)",
  "beef": "Beef (incl. suya)",
  "meat": "Beef (incl. suya)",
  "ponmo": "Beef (incl. suya)",
  "shaki": "Beef (incl. suya)",
  "assorted meat": "Beef (incl. suya)",
  "goat meat": "Goat meat",
  "asun": "Goat meat",
  "chicken": "Chicken",
  "fried chicken": "Chicken",
  "turkey": "Chicken",
  "egg": "Egg, hen",
  "eggs": "Egg, hen",
  "boiled egg": "Egg, hen",
  "fried egg": "Egg, hen",
  "omelette": "Egg, hen",
  "fish": "Fish fillet",
  "fried fish": "Fish fillet",
  "titus": "Fish fillet",
  "mackerel": "Fish fillet",
  "catfish": "Fish fillet",
  "stockfish": "Dried fish / crayfish",
  "dried fish": "Dried fish / crayfish",
  "crayfish": "Dried fish / crayfish",
  "milk": "Milk, cow",
  "powdered milk": "Milk powder",
  "peak milk": "Milk powder",
};

// Words that describe preparation, not the food. Ignored when comparing.
const STOP = new Set([
  "a", "an", "and", "the", "of", "with", "in", "on", "fried", "boiled", "steamed", "stewed",
  "roasted", "raw", "dried", "dry", "fresh", "grilled", "cooked", "sauce", "stew", "slice",
  "slices", "piece", "pieces", "incl", "as", "sold", "shelled", "nigerian", "style", "riro", // riro = "stirred"
]);

export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !STOP.has(t));

/** All the names a food row is known by: "Soy cheese / Nigerian tofu" -> ["soy cheese", "nigerian tofu", ...]. */
function namesOf(f: Food): string[] {
  const parts = [f.food, f.local_name ?? ""]
    .flatMap((s) => s.split(/[\/(),]/))
    .map(norm)
    .filter(Boolean);
  return [...new Set([norm(f.food), norm(f.local_name), ...parts].filter(Boolean))];
}

function scoreLabel(label: string, f: Food): number {
  const l = norm(label);
  if (!l) return 0;
  let best = 0;
  const lt = tokens(label);
  for (const name of namesOf(f)) {
    if (name === l) return 1;
    // whole-phrase containment, e.g. "jollof with chicken" contains "chicken"
    if ((` ${l} `).includes(` ${name} `) || (` ${name} `).includes(` ${l} `)) best = Math.max(best, 0.8);
    const nt = tokens(name);
    if (lt.length && nt.length) {
      const shared = lt.filter((t) => nt.includes(t)).length;
      best = Math.max(best, (0.7 * shared) / Math.max(lt.length, nt.length));
    }
  }
  return best;
}

/** Longest alias contained in the label wins: "jollof rice" beats "rice". */
function aliasFor(label: string): string | null {
  const l = ` ${norm(label)} `;
  let hit: string | null = null;
  for (const key of Object.keys(ALIASES)) {
    if (l.includes(` ${key} `) && (!hit || key.length > hit.length)) hit = key;
  }
  return hit ? ALIASES[hit] : null;
}

/**
 * Match a vision label (plus its local name) to a foods row.
 * Order: exact alias -> exact/contained name -> alias contained in label -> token overlap.
 * Returns null when nothing is a reasonable match, so the user picks it from the dropdown.
 */
export function matchFood(label: string, localName: string | null | undefined, foods: Food[]): Food | null {
  const byName = new Map(foods.map((f) => [f.food, f]));
  const candidates = [label, localName ?? ""].filter((s) => norm(s));

  for (const c of candidates) {
    const exact = ALIASES[norm(c)];
    if (exact && byName.has(exact)) return byName.get(exact)!;
  }

  let best: Food | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    for (const f of foods) {
      const s = scoreLabel(c, f);
      if (s > bestScore) { best = f; bestScore = s; }
    }
  }
  if (bestScore >= 0.8) return best;

  for (const c of candidates) {
    const a = aliasFor(c);
    if (a && byName.has(a)) return byName.get(a)!;
  }

  return bestScore >= 0.4 ? best : null;
}
