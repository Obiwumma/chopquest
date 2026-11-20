import { createHash } from "node:crypto";
import { query } from "@/lib/db";
import { analyzeMeal, sanitizeVision } from "@/lib/ai/vision";
import { AiError, aiErrorMessage } from "@/lib/ai/client";
import { listFoods } from "@/lib/foods-db";
import { matchFood } from "@/lib/match";
import type { ScanResponse, VisionResult } from "@/lib/foods";

export const maxDuration = 60;

const MAX_BASE64 = 3_000_000; // ~2.2 MB JPEG; the client sends ~768px images (~100 KB)

// POST /api/scan { image: base64 JPEG (no data: prefix) } -> ScanResponse
// Sends the photo to the AI (OpenRouter) and returns draft items for the confirm screen.
// Nothing is saved to scans here and the photo is never stored — only the parsed JSON is cached by hash.
export async function POST(req: Request) {
  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof image !== "string" || image.length < 100) {
    return Response.json({ error: "No photo received." }, { status: 400 });
  }
  const base64 = image.replace(/^data:image\/\w+;base64,/, "");
  if (base64.length > MAX_BASE64) {
    return Response.json({ error: "Photo is too large. Try again." }, { status: 413 });
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return Response.json({ error: "That file isn't a photo." }, { status: 400 });
  }

  const hash = createHash("sha256").update(base64).digest("hex");

  // 1. Cache lookup (a missing table must not break scanning).
  let vision: VisionResult | null = null;
  let cached = false;
  try {
    const rows = await query<{ result: string }>("SELECT result FROM scan_cache WHERE image_hash = ?", [hash]);
    if (rows.length) {
      vision = sanitizeVision(JSON.parse(rows[0].result));
      cached = true;
    }
  } catch (e) {
    console.warn("scan_cache lookup failed (run npm run db:setup?)", (e as Error).message);
  }

  // 2. AI (OpenRouter).
  if (!vision) {
    try {
      vision = await analyzeMeal(base64);
    } catch (e) {
      if (e instanceof AiError) {
        console.error("scan ai:", e.kind, e.message);
        if (e.kind === "unreadable")
          return Response.json({ error: "Couldn't make out the food. Try a clearer, brighter photo from above." }, { status: 422 });
        const { message, status } = aiErrorMessage(e);
        return Response.json({ error: message, code: e.kind }, { status });
      }
      console.error("scan failed", e);
      return Response.json({ error: "The scanner had a problem. Try again." }, { status: 502 });
    }
    if (vision.items.length) {
      try {
        await query("INSERT INTO scan_cache (image_hash, result) VALUES (?, ?) ON CONFLICT (image_hash) DO NOTHING", [
          hash,
          JSON.stringify(vision),
        ]);
      } catch (e) {
        console.warn("scan_cache write failed", (e as Error).message);
      }
    }
  }

  if (!vision.items.length) {
    return Response.json({ error: "No food spotted in that photo. Try again with the plate in view." }, { status: 422 });
  }

  // 3. Match each item to a foods row so the confirm list starts pre-filled.
  let foods: Awaited<ReturnType<typeof listFoods>> = [];
  try {
    foods = await listFoods();
  } catch (e) {
    console.error("listFoods failed", e);
  }
  const body: ScanResponse = {
    dish_name: vision.dish_name,
    cached,
    items: vision.items.map((it) => ({
      ...it,
      matched_food_id: matchFood(it.food, it.local_name, foods)?.id ?? null,
    })),
  };
  return Response.json(body);
}
