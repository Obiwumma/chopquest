import { connection } from "next/server";
import { query } from "@/lib/db";
import { buildLeaderboard, type Eaten, type Member } from "@/lib/leaderboard";
import { lagosWeekStart } from "@/lib/rewards";

// GET /api/leaderboard[?userId=12] -> Leaderboard (see src/lib/leaderboard.ts)
// Groups ranked by members' average weekly diversity this Lagos week; resets Monday 00:00 WAT.
export async function GET(req: Request) {
  await connection(); // always run at request time, never prerender at build
  const raw = new URL(req.url).searchParams.get("userId");
  const userId = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  const now = new Date();

  try {
    const [members, eaten] = await Promise.all([
      query<Member>("SELECT id, group_name FROM users"),
      // Only this week's matched protein items; buildLeaderboard de-duplicates groups per user.
      query<Eaten>(
        `SELECT s.user_id, f.dex_group, s.created_at
         FROM scans s
         JOIN scan_items i ON i.scan_id = s.id
         JOIN foods f ON f.id = i.food_id
         WHERE s.created_at >= ? AND f.dex_group <> 'Staple'`,
        [lagosWeekStart(now).toISOString()],
      ),
    ]);
    return Response.json(buildLeaderboard(members, eaten, now, userId));
  } catch (e) {
    console.error("leaderboard failed", e);
    return Response.json({ error: "Couldn't load the leaderboard. Try again." }, { status: 500 });
  }
}
