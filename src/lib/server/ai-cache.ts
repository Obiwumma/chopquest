// Read-through cache for AI answers (server only). A missing table or DB hiccup never blocks the AI.
import { createHash } from "node:crypto";
import { query } from "@/lib/db";
import type { AiJsonResult } from "@/lib/ai/client";

export const cacheKey = (task: string, input: unknown) =>
  `${task}:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;

/** Return the cached JSON for `key`, or run `call`, store its answer and return it. */
export async function cachedAiJson(key: string, call: () => Promise<AiJsonResult>): Promise<{ json: unknown; cached: boolean }> {
  try {
    const rows = await query<{ result: string }>("SELECT result FROM ai_cache WHERE cache_key = ?", [key]);
    if (rows.length) return { json: JSON.parse(rows[0].result), cached: true };
  } catch (e) {
    console.warn("ai_cache read failed (run npm run db:setup?)", (e as Error).message);
  }
  const out = await call();
  try {
    await query(
      "INSERT INTO ai_cache (cache_key, result, model, tokens, cost_usd) VALUES (?, ?, ?, ?, ?) ON CONFLICT (cache_key) DO NOTHING",
      [key, JSON.stringify(out.json), out.usage.model, out.usage.promptTokens + out.usage.completionTokens, out.usage.costUsd],
    );
  } catch (e) {
    console.warn("ai_cache write failed", (e as Error).message);
  }
  return { json: out.json, cached: false };
}
