import { connection } from "next/server";

// GET /api/kitchen/demo-codes -> { codes: { "<slug>": "123456", ... } } while the demo switch is on.
// Switch: PUBLIC_KITCHEN_CODES=1 on the server. Off (unset) -> 404 and no code is ever sent.
// The codes come from KITCHEN_CODES, the same variable that sets them. Rotate them after the demo.
export async function GET() {
  await connection();
  if (process.env.PUBLIC_KITCHEN_CODES !== "1") return Response.json({ error: "Not found." }, { status: 404 });
  const codes: Record<string, string> = {};
  for (const pair of (process.env.KITCHEN_CODES ?? "").split(",")) {
    const [slug, code] = pair.split(":").map((s) => s.trim());
    if (slug && /^\d{6}$/.test(code ?? "")) codes[slug] = code;
  }
  return Response.json({ codes }, { headers: { "Cache-Control": "no-store" } });
}
