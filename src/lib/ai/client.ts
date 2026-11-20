// OpenRouter client: one OpenAI-compatible API for many models, paid from the team's credits.
// Every call asks for JSON, never trusts it (callers sanitise), and maps failures to friendly kinds.
// Docs: https://openrouter.ai/docs

export type AiErrorKind = "rate_limit" | "credits" | "config" | "unreadable" | "upstream";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export type AiUsage = { model: string; promptTokens: number; completionTokens: number; costUsd: number | null };

export type AiJsonRequest = {
  system: string;
  text: string;
  imageBase64Jpeg?: string; // no data: prefix
  maxTokens?: number;
  temperature?: number;
};

export type AiJsonResult = { json: unknown; usage: AiUsage };

// OPENROUTER_BASE_URL is only for tests (a local fake server); leave it unset in real use.
const endpoint = () => `${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`;
// Claude through OpenRouter (team credits). Both take images and JSON mode; override with env vars.
export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
export const DEFAULT_FALLBACK_MODEL = "anthropic/claude-sonnet-4.6";

const isClaude = (model: string) => model.startsWith("anthropic/");
// Claude 5-generation models think by default, and thinking tokens count toward max_tokens.
const thinksByDefault = (model: string) => /^anthropic\/claude-[a-z]+-5/.test(model);

/** The model-specific part of the request body. */
export function samplingFor(model: string, req: Pick<AiJsonRequest, "temperature" | "maxTokens">): Record<string, number> {
  const maxTokens = req.maxTokens ?? 1200;
  return {
    // Claude: leave sampling at its default (newer models and API versions reject a temperature).
    ...(isClaude(model) ? {} : { temperature: req.temperature ?? 0.2 }),
    // Give thinking models room so their reasoning can't cut the JSON answer short.
    max_tokens: thinksByDefault(model) ? Math.max(maxTokens, 4000) : maxTokens,
  };
}

/** Pull the JSON object out of a model reply: plain JSON, fenced ```json, or text around one {...}. */
export function parseModelJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError("unreadable", "The AI returned something that isn't JSON");
  }
}

function errorFor(status: number, detail: string): AiError {
  if (status === 429) return new AiError("rate_limit", `OpenRouter 429: ${detail}`);
  if (status === 402) return new AiError("credits", `OpenRouter 402 (out of credits): ${detail}`);
  if (status === 401 || status === 403) return new AiError("config", `OpenRouter ${status}: ${detail}`);
  if (status === 400) return new AiError("unreadable", `OpenRouter 400: ${detail}`);
  return new AiError("upstream", `OpenRouter ${status}: ${detail}`);
}

async function callOnce(model: string, req: AiJsonRequest, key: string, fetchImpl: typeof fetch): Promise<AiJsonResult> {
  const content: unknown[] = [{ type: "text", text: req.text }];
  if (req.imageBase64Jpeg) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${req.imageBase64Jpeg}` } });

  let res: Response;
  try {
    res = await fetchImpl(endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "ChopQuest",
        ...(process.env.OPENROUTER_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_REFERER } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        ...samplingFor(model, req),
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    throw new AiError("upstream", `OpenRouter request failed: ${(e as Error).message}`);
  }

  const raw = await res.text();
  let data: {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    error?: { code?: number | string; message?: string };
    model?: string;
  } = {};
  try {
    data = JSON.parse(raw);
  } catch {
    if (!res.ok) throw errorFor(res.status, raw.slice(0, 200));
    throw new AiError("upstream", "OpenRouter sent a reply that isn't JSON");
  }
  // OpenRouter can report an error inside a 200 response too.
  if (!res.ok || data.error) {
    const code = Number(data.error?.code) || res.status;
    throw errorFor(code, data.error?.message ?? raw.slice(0, 200));
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AiError("unreadable", "The AI returned an empty answer");
  return {
    json: parseModelJson(text),
    usage: {
      model: data.model ?? model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      costUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
    },
  };
}

/**
 * Ask the model for JSON. Tries the main model (OPENROUTER_MODEL, default Claude Haiku 5.5), retries
 * once on a server error, then tries the fallback (OPENROUTER_MODEL_FALLBACK, default Claude Sonnet
 * 4.6; set it to "none" to turn the fallback off). Rate limits, credit and key problems are not retried.
 */
export async function aiJson(req: AiJsonRequest, fetchImpl: typeof fetch = fetch): Promise<AiJsonResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiError("config", "OPENROUTER_API_KEY is not set");
  const main = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackEnv = process.env.OPENROUTER_MODEL_FALLBACK;
  const fallback = fallbackEnv === "none" ? "" : fallbackEnv || DEFAULT_FALLBACK_MODEL;
  const models = [...new Set([main, fallback].filter((m): m is string => Boolean(m)))];

  let last: AiError = new AiError("upstream", "No model tried");
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callOnce(model, req, key, fetchImpl);
        console.info(`ai: ${out.usage.model} ${out.usage.promptTokens}+${out.usage.completionTokens} tokens${out.usage.costUsd != null ? ` $${out.usage.costUsd}` : ""}`);
        return out;
      } catch (e) {
        last = e instanceof AiError ? e : new AiError("upstream", String(e));
        if (last.kind === "rate_limit" || last.kind === "credits" || last.kind === "config") throw last;
        if (last.kind === "unreadable") break; // a bad answer won't fix itself on the same model: try the fallback
      }
    }
  }
  throw last;
}

/** A short, friendly message for the screen. */
export function aiErrorMessage(e: unknown): { message: string; status: number } {
  const kind = e instanceof AiError ? e.kind : "upstream";
  switch (kind) {
    case "rate_limit":
      return { message: "Chloe is busy right now. Try again in a minute.", status: 429 };
    case "credits":
      return { message: "Chloe is out of AI credits. Tell the team.", status: 503 };
    case "config":
      return { message: "Chloe isn't set up yet. Ask the team to check the OpenRouter key.", status: 503 };
    case "unreadable":
      return { message: "Chloe couldn't work that out. Try again or add the parts by hand.", status: 422 };
    default:
      return { message: "Chloe had a problem. Try again.", status: 502 };
  }
}
