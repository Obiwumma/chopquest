// Kitchen card: the AI writes a menu name, a student blurb and prep steps for one chosen swap.
// The validator then checks the text against our verified foods: no ingredient outside the swap,
// no meat except where it's being replaced, no health claims. One corrected retry, then a safe
// template card, so publishing never depends on the model behaving.
import { aiJson, type AiJsonResult } from "./client";
import type { DishPart, Food, KitchenCard, SwapOption } from "../types";

export type CardInput = { dishName: string; breakdown: DishPart[]; option: SwapOption; foods: Food[] };
export type CardResult = { card: KitchenCard; source: "ai" | "ai-retry" | "template"; problems: string[] };

type Ask = (req: Parameters<typeof aiJson>[0]) => Promise<Pick<AiJsonResult, "json">>;

export const CARD_SYSTEM = `You write short, practical kitchen cards for Nigerian university cafeterias.
Plain Nigerian English. No health or medical claims. Answer with JSON only.`;

const PANTRY = "salt, oil, palm oil, pepper, onion, tomato, stock cube, seasoning, curry, thyme and spices";
const NEGATION = /\b(instead of|in place of|without|no|replac\w*|swap\w*|skip|leave out)\b[^.;,]{0,25}$/i;
const HEALTH = /\b(cure[sd]?|heal(s|ing)?|prevent(s|ing)?|treat(s|ment)?|diabet\w*|cancer|weight[- ]loss|detox\w*|immunity|medicin\w*)\b/i;

// Words that describe a food's state, not the food ("Instant noodles, dry"): never treated as a food name.
const DESCRIPTORS = new Set(["dry", "dried", "raw", "fresh", "ripe", "milled", "shelled", "cooked", "boiled", "steamed", "fried", "incl. suya", "hen", "cow", "powder"]);

/** Every name a food is known by, lower case: "Soy chunks (textured soy protein)" -> soy chunks, textured soy protein, soya chunks. */
function namesOf(f: Food): string[] {
  return [
    ...new Set(
      [f.food, f.local_name ?? ""]
        .flatMap((s) => s.split(/[\/(),]/))
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length >= 3 && !DESCRIPTORS.has(s)),
    ),
  ];
}

const wordRe = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}s?\\b`, "i");

export function buildCardPrompt(input: CardInput, problems: string[] = []): string {
  const byId = new Map(input.foods.map((f) => [f.id, f]));
  const removed = input.option.replaces.map((p) => `${p.label} (${p.grams} g)`).join(", ");
  const added = input.option.adds
    .map((a) => {
      const f = byId.get(a.foodId);
      return `${f?.food ?? a.label} (${a.grams} g${f?.basis ? `, weighed ${f.basis.toLowerCase()}` : ""})`;
    })
    .join(", ");
  const staying = input.breakdown.filter((p) => !input.option.replaces.some((r) => r.foodId === p.foodId && r.label === p.label)).map((p) => p.label).join(", ");
  return `Original dish: "${input.dishName}".
Take out: ${removed}.
Put in, per plate: ${added}.
Stays the same: ${staying || "the rest of the dish"}.

Write a kitchen card for this alt protein (plant-based) version. In student-facing text say "alt protein", not "plant-based".
Use ONLY the foods above plus pantry items (${PANTRY}). Do not add any other food, meat, fish, egg or crayfish.
Mention the removed meat only as what is being replaced.
- "menuName": at most 4 words, something students would order.
- "studentBlurb": one sentence, at most 20 words, no health claims.
- "steps": 3 to 6 short steps a busy campus kitchen can follow, with the per-plate amounts above.
${problems.length ? `\nYour last answer broke these rules, fix them: ${problems.join("; ")}.\n` : ""}
Return JSON exactly in this shape:
{"menuName": "string", "studentBlurb": "string", "steps": ["string"]}`;
}

/** Coerce model JSON into a card shape (validated is decided by validateCard). */
export function sanitizeCard(raw: unknown): KitchenCard | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const menuName = typeof o.menuName === "string" ? o.menuName.trim().slice(0, 60) : "";
  const studentBlurb = typeof o.studentBlurb === "string" ? o.studentBlurb.trim().slice(0, 200) : "";
  const steps = Array.isArray(o.steps) ? o.steps.filter((s): s is string => typeof s === "string").map((s) => s.trim().slice(0, 220)).filter(Boolean).slice(0, 6) : [];
  if (!menuName || !studentBlurb || steps.length < 2) return null;
  return { menuName, studentBlurb, steps, validated: false };
}

/** Check a card against the swap: returns the list of problems (empty = valid). */
export function validateCard(card: KitchenCard, input: CardInput): string[] {
  const byId = new Map(input.foods.map((f) => [f.id, f]));
  const addedFoods = input.option.adds.map((a) => byId.get(a.foodId)).filter((f): f is Food => Boolean(f));
  const removedIds = new Set(input.option.replaces.map((p) => p.foodId));
  const stayingFoods = input.breakdown.filter((p) => p.foodId != null && !removedIds.has(p.foodId)).map((p) => byId.get(p.foodId!)).filter((f): f is Food => Boolean(f));
  // Plant foods of the same family as anything on the new plate are fine ("soya" with soya chunks,
  // "egusi" with egusi soup). Meat is never in an allowed family.
  const allowedGroups = new Set([...addedFoods, ...stayingFoods].filter((f) => f.type !== "Animal").map((f) => f.dex_group));
  const allowedIds = new Set([...addedFoods, ...stayingFoods].map((f) => f.id));
  // Hide the allowed foods' own names first, so "milk" inside "soya milk" isn't read as cow's milk.
  const allowedNames = [...addedFoods, ...stayingFoods, ...input.foods.filter((f) => f.type !== "Animal" && allowedGroups.has(f.dex_group))]
    .flatMap(namesOf)
    .sort((x, y) => y.length - x.length);
  const mask = (t: string) => allowedNames.reduce((acc, n) => acc.replace(new RegExp(wordRe(n).source, "gi"), " "), t);

  const problems: string[] = [];
  const sentences = [card.menuName, card.studentBlurb, ...card.steps].flatMap((t) => t.split(/(?<=[.!?;])\s+/)).map(mask);

  for (const f of input.foods) {
    if (allowedIds.has(f.id)) continue;
    const isRemovedMeat = removedIds.has(f.id) || f.type === "Animal";
    if (!isRemovedMeat && allowedGroups.has(f.dex_group)) continue; // e.g. "soya" when soy chunks were added
    for (const name of namesOf(f)) {
      const re = wordRe(name);
      for (const s of sentences) {
        const m = re.exec(s);
        if (!m) continue;
        if (isRemovedMeat && NEGATION.test(s.slice(0, m.index))) continue; // "instead of chicken" is fine
        problems.push(isRemovedMeat ? `mentions ${name} as an ingredient` : `adds ${name}, which is not in the swap`);
      }
    }
  }
  if ([card.studentBlurb, ...card.steps].some((t) => HEALTH.test(t))) problems.push("makes a health claim");
  if (card.studentBlurb.split(/\s+/).length > 25) problems.push("the student blurb is too long");
  return [...new Set(problems)];
}

/** A safe card built only from the swap itself. Used when the AI is down or keeps breaking the rules. */
export function templateCard(dishName: string, option: SwapOption): KitchenCard {
  const removedLabels = option.replaces.map((p) => p.label.toLowerCase());
  const removed = removedLabels.join(" and ");
  const addedNames = option.adds.map((a) => a.label.toLowerCase());
  let base = dishName;
  for (const r of option.replaces) base = base.replace(new RegExp(`\\b${r.label}\\b`, "ig"), "");
  base = base.replace(/\b(with|and)\s*$/i, "").replace(/\s+/g, " ").trim() || dishName;
  const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    menuName: title(`${option.adds[0]?.label ?? "Plant"} ${base}`).slice(0, 60),
    studentBlurb: `Our ${base.toLowerCase()} with ${addedNames.join(" and ")} instead of ${removed}.`,
    steps: [
      `Prepare the ${base.toLowerCase()} exactly as usual, without the ${removed}.`,
      ...option.adds.map((a) => `Cook ${a.label.toLowerCase()} the usual way: ${a.grams} g per plate.`),
      `Serve it in place of the ${removed}, one portion per plate.`,
    ],
    validated: true,
  };
}

/** Ask the AI for a card, validate it, retry once with the problems listed, else fall back to the template. */
export async function writeKitchenCard(input: CardInput, ask: Ask = aiJson): Promise<CardResult> {
  let problems: string[] = [];
  for (const attempt of [0, 1] as const) {
    try {
      const { json } = await ask({ system: CARD_SYSTEM, text: buildCardPrompt(input, problems), maxTokens: 700, temperature: 0.4 });
      const card = sanitizeCard(json);
      if (!card) {
        problems = ["the answer was missing menuName, studentBlurb or steps"];
        continue;
      }
      problems = validateCard(card, input);
      if (!problems.length) return { card: { ...card, validated: true }, source: attempt ? "ai-retry" : "ai", problems: [] };
    } catch (e) {
      console.warn("kitchen card AI failed, using template", (e as Error).message);
      return { card: templateCard(input.dishName, input.option), source: "template", problems: [(e as Error).message] };
    }
  }
  return { card: templateCard(input.dishName, input.option), source: "template", problems };
}
