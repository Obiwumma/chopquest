import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, aiJson, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, parseModelJson, samplingFor } from "./client";
import { breakdownDish, buildBreakdownPrompt, sanitizeBreakdown } from "./breakdown";
import { templateCard, validateCard, writeKitchenCard, type CardInput } from "./kitchen-card";
import { findSwaps } from "../swap";
import { DEFAULT_LIMITS, type DishPart } from "../types";
import { foodByName, loadFoods } from "../test-foods";

const FOODS = loadFoods({ Chicken: 6000, "Rice, milled": 1500, "Soy chunks (textured soy protein)": 3000, "Moi moi": 2500 });
const id = (name: string) => foodByName(FOODS, name).id;

// ---------- client ----------

const reply = (content: string, status = 200, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ model: "test/model", choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 }, ...extra }), { status });
const errorReply = (status: number, message = "nope") => new Response(JSON.stringify({ error: { code: status, message } }), { status });

describe("aiJson (OpenRouter client)", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("OPENROUTER_MODEL", "main/model");
    vi.stubEnv("OPENROUTER_MODEL_FALLBACK", "none");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends the key, model, JSON mode and the image, and parses the answer", async () => {
    const fetchMock = vi.fn(async () => reply('{"ok": true}'));
    const out = await aiJson({ system: "s", text: "t", imageBase64Jpeg: "QUJD" }, fetchMock as unknown as typeof fetch);
    expect(out.json).toEqual({ ok: true });
    expect(out.usage).toMatchObject({ promptTokens: 10, completionTokens: 5, costUsd: 0.0001 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("main/model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,QUJD");
  });

  it("defaults to Claude Haiku 5.5, falling back to Claude Sonnet 4.6", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_MODEL_FALLBACK", "");
    expect(DEFAULT_MODEL).toBe("anthropic/claude-haiku-5.5");
    expect(DEFAULT_FALLBACK_MODEL).toBe("anthropic/claude-sonnet-4.6");
    const f = vi.fn().mockResolvedValueOnce(errorReply(502)).mockResolvedValueOnce(errorReply(502)).mockResolvedValueOnce(reply('{"ok":1}'));
    await aiJson({ system: "s", text: "t" }, f as unknown as typeof fetch);
    const models = (f.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => JSON.parse(String(init.body)).model);
    expect(models).toEqual([DEFAULT_MODEL, DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]);
  });

  it("sends no temperature to Claude, and gives thinking models room for the answer", () => {
    expect(samplingFor("anthropic/claude-haiku-4.5", { maxTokens: 800 })).toEqual({ max_tokens: 800 });
    expect(samplingFor("anthropic/claude-sonnet-4.6", {})).toEqual({ max_tokens: 1200 });
    expect(samplingFor("anthropic/claude-haiku-5.5", { maxTokens: 800 })).toEqual({ max_tokens: 4000 });
    expect(samplingFor("google/gemini-2.5-flash", { maxTokens: 800, temperature: 0.4 })).toEqual({ temperature: 0.4, max_tokens: 800 });
  });

  it("reads JSON wrapped in code fences or text", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here you go: {"a":2} hope it helps')).toEqual({ a: 2 });
    expect(() => parseModelJson("no json here")).toThrow(AiError);
  });

  it("fails fast on missing key, rate limit and empty credits (no retries)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(aiJson({ system: "s", text: "t" }, vi.fn() as unknown as typeof fetch)).rejects.toMatchObject({ kind: "config" });
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    for (const [status, kind] of [[429, "rate_limit"], [402, "credits"], [401, "config"]] as const) {
      const f = vi.fn(async () => errorReply(status));
      await expect(aiJson({ system: "s", text: "t" }, f as unknown as typeof fetch)).rejects.toMatchObject({ kind });
      expect(f).toHaveBeenCalledTimes(1);
    }
  });

  it("treats an error inside a 200 reply as an error", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 402, message: "Insufficient credits" } }), { status: 200 }));
    await expect(aiJson({ system: "s", text: "t" }, f as unknown as typeof fetch)).rejects.toMatchObject({ kind: "credits" });
  });

  it("retries a server error once, then moves to the fallback model", async () => {
    vi.stubEnv("OPENROUTER_MODEL_FALLBACK", "backup/model");
    const f = vi.fn().mockResolvedValueOnce(errorReply(502)).mockResolvedValueOnce(errorReply(503)).mockResolvedValueOnce(reply('{"from":"backup"}'));
    const out = await aiJson({ system: "s", text: "t" }, f as unknown as typeof fetch);
    expect(out.json).toEqual({ from: "backup" });
    expect(f).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String((f.mock.calls[2] as unknown as [string, RequestInit])[1].body)).model).toBe("backup/model");
  });
});

// ---------- breakdown ----------

describe("dish breakdown", () => {
  it("tells the model each food's basis so grams come back dry or raw", () => {
    const prompt = buildBreakdownPrompt({ menuItemName: "Chicken jollof rice", cafeteria: "Munchbox", priceNgn: 1500 }, FOODS);
    expect(prompt).toContain("Rice, milled (Rice): grams as dry");
    expect(prompt).toContain("Chicken: grams as raw");
    expect(prompt).toContain("₦1500");
  });

  it("grounds parts in our foods, clamps grams and drops junk", () => {
    const parts = sanitizeBreakdown(
      {
        parts: [
          { food: "Rice, milled", grams: 85, role: "staple", confidence: 0.9 },
          { food: "chicken", grams: 9000, role: "protein", confidence: 2 },
          { food: "jollof sauce", grams: 60, role: "weird" },
          { food: "", grams: 10, role: "side" },
          { food: "plantain", grams: -5, role: "side" },
        ],
      },
      FOODS,
    );
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ foodId: id("Rice, milled"), grams: 85, role: "staple", confidence: 0.9 });
    expect(parts[1]).toMatchObject({ foodId: id("Chicken"), grams: 800, confidence: 1 });
    expect(parts[2]).toMatchObject({ role: "side" });
  });

  it("never counts a sauce named after a dish as the staple, and keeps the AI's own names", () => {
    const parts = sanitizeBreakdown(
      { parts: [{ food: "Jollof rice", grams: 85, role: "staple" }, { food: "Jollof sauce", grams: 50, role: "soup" }, { food: "Spaghetti", grams: 100, role: "staple" }] },
      FOODS,
    );
    expect(parts[0]).toMatchObject({ foodId: id("Rice, milled"), label: "Jollof rice" });
    expect(parts[1]).toMatchObject({ foodId: null, label: "Jollof sauce" });
    expect(parts[2]).toMatchObject({ foodId: id("Wheat flour (bread)"), label: "Spaghetti" });
  });

  it("accepts our name with its local name, and never matches a soup by shared words alone", () => {
    const parts = sanitizeBreakdown(
      {
        parts: [
          { food: "Rice, milled (Rice)", grams: 85, role: "staple" },
          { food: "Tomato pepper stew (no meat)", grams: 100, role: "soup" },
          { food: "Egusi soup", grams: 120, role: "soup" },
          { food: "Beef stew (tomato and pepper base, oil)", grams: 90, role: "soup" },
          { food: "Vegetable oil (used for frying chicken)", grams: 10, role: "side" },
        ],
      },
      FOODS,
    );
    expect(parts[3]).toMatchObject({ foodId: null, label: "Beef stew (tomato and pepper base, oil)" });
    expect(parts[4]).toMatchObject({ foodId: null });
    expect(parts[0]).toMatchObject({ foodId: id("Rice, milled"), label: "Rice" });
    expect(parts[1]).toMatchObject({ foodId: null, label: "Tomato pepper stew (no meat)" });
    expect(parts[2]).toMatchObject({ foodId: id("Egusi soup (no meat)") });
  });

  it("returns an empty list for nonsense instead of crashing", () => {
    expect(sanitizeBreakdown("hello", FOODS)).toEqual([]);
    expect(sanitizeBreakdown({ parts: "x" }, FOODS)).toEqual([]);
  });

  it("feeds straight into the swap engine", async () => {
    const parts = await breakdownDish({ menuItemName: "Chicken jollof rice", cafeteria: "Munchbox", priceNgn: 1500 }, FOODS, async () => ({
      json: { parts: [{ food: "Rice, milled", grams: 85, role: "staple" }, { food: "Chicken", grams: 120, role: "protein" }] },
    }));
    const options = findSwaps(parts, "Chicken jollof rice", DEFAULT_LIMITS, FOODS);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].replaces[0].foodId).toBe(id("Chicken"));
  });
});

// ---------- kitchen card ----------

const breakdown: DishPart[] = [
  { foodId: id("Rice, milled"), label: "Rice", grams: 85, role: "staple" },
  { foodId: id("Chicken"), label: "Chicken", grams: 120, role: "protein" },
];
const option = findSwaps(breakdown, "Chicken jollof rice", DEFAULT_LIMITS, FOODS)[0];
const input: CardInput = { dishName: "Chicken jollof rice", breakdown, option, foods: FOODS };
const goodCard = {
  menuName: "Soya Jollof Special",
  studentBlurb: "Our smoky jollof rice with soya chunks instead of chicken.",
  steps: ["Cook the jollof rice as usual.", "Soak the soya chunks, then fry them in the stew base.", "Serve one portion of soya chunks on each plate."],
  validated: false,
};

describe("kitchen card validator", () => {
  it("passes a card that only uses the swap's foods and pantry items", () => {
    expect(option.adds.map((a) => a.foodId)).toContain(id("Soy chunks (textured soy protein)"));
    expect(validateCard(goodCard, input)).toEqual([]);
  });

  it("doesn't mistake describing words like dry or fresh for foods", () => {
    const card = { ...goodCard, steps: ["Soak 60 g dry soya chunks in fresh water.", ...goodCard.steps] };
    expect(validateCard(card, input)).toEqual([]);
  });

  it("allows the removed meat only when it's being replaced", () => {
    const bad = { ...goodCard, steps: [...goodCard.steps, "Top with fried chicken."] };
    expect(validateCard(bad, input)).toContain("mentions chicken as an ingredient");
  });

  it("catches a food that isn't in the swap, and crayfish", () => {
    const bad = { ...goodCard, steps: ["Add two wraps of moi moi.", "Season with crayfish."] };
    const problems = validateCard(bad, input);
    expect(problems.some((p) => p.includes("moi moi"))).toBe(true);
    expect(problems.some((p) => p.includes("crayfish"))).toBe(true);
  });

  it("catches health claims", () => {
    expect(validateCard({ ...goodCard, studentBlurb: "Soya jollof that helps cure diabetes." }, input)).toContain("makes a health claim");
  });

  it("builds a template card that passes its own validator", () => {
    const card = templateCard("Chicken jollof rice", option);
    expect(card.validated).toBe(true);
    expect(validateCard(card, input)).toEqual([]);
    expect(card.menuName.toLowerCase()).not.toContain("chicken");
  });
});

describe("writeKitchenCard", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("returns a valid AI card first time", async () => {
    const out = await writeKitchenCard(input, async () => ({ json: goodCard }));
    expect(out).toMatchObject({ source: "ai", card: { menuName: "Soya Jollof Special", validated: true } });
  });

  it("retries once with the problems listed, then accepts the fixed card", async () => {
    const ask = vi.fn().mockResolvedValueOnce({ json: { ...goodCard, steps: ["Add egg on top.", ...goodCard.steps] } }).mockResolvedValueOnce({ json: goodCard });
    const out = await writeKitchenCard(input, ask);
    expect(out.source).toBe("ai-retry");
    expect(ask.mock.calls[1][0].text).toContain("broke these rules");
  });

  it("falls back to the template when the AI keeps breaking the rules or is down", async () => {
    const stubborn = await writeKitchenCard(input, async () => ({ json: { ...goodCard, studentBlurb: "Cures malaria." } }));
    expect(stubborn.source).toBe("template");
    expect(stubborn.card.validated).toBe(true);
    const down = await writeKitchenCard(input, async () => {
      throw new AiError("credits", "out of credits");
    });
    expect(down.source).toBe("template");
  });
});
