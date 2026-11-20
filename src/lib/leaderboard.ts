// Group leaderboard (task 8a, Dev 3). Pure functions only, so it is testable and the offline demo can reuse it.
// Groups are ranked by the average weekly diversity of their members: distinct protein groups eaten this
// Lagos week (Mon-Sun, WAT), Staple excluded. Grams, calories and price never count.
import { lagosWeekStart, proteinGroups } from "./rewards";

/** Groups with fewer members than this go in "Getting started", not the ranked list. */
export const MIN_MEMBERS = 3;

export type Member = { id: number; group_name: string };
/** One eaten item: who ate it, which dex_group, when (ISO-8601 UTC). */
export type Eaten = { user_id: number; dex_group: string | null; created_at: string };

export type GroupRow = { group: string; members: number; avgDiversity: number; rank?: number };
export type Leaderboard = {
  weekStart: string; // ISO instant of Monday 00:00 Lagos time
  ranked: GroupRow[];
  gettingStarted: GroupRow[];
  you?: { userId: number; group: string; diversity: number; rank: number | null };
};

/** Per-user count of distinct protein groups eaten this week. Users with no scans are absent (= 0). */
export function diversityByUser(eaten: Eaten[], now: Date = new Date()): Map<number, number> {
  const start = lagosWeekStart(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const groups = new Map<number, (string | null)[]>();
  for (const e of eaten) {
    const t = new Date(e.created_at).getTime();
    if (t < start || t >= end) continue;
    const list = groups.get(e.user_id) ?? [];
    list.push(e.dex_group);
    groups.set(e.user_id, list);
  }
  const out = new Map<number, number>();
  groups.forEach((g, uid) => out.set(uid, proteinGroups(g).length));
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rank groups by the average weekly diversity over ALL members (members who didn't scan count as 0).
 * Ties: more members first, then name. Groups under MIN_MEMBERS go in `gettingStarted`.
 */
export function buildLeaderboard(members: Member[], eaten: Eaten[], now: Date = new Date(), userId?: number): Leaderboard {
  const div = diversityByUser(eaten, now);
  const byGroup = new Map<string, number[]>();
  for (const m of members) {
    const list = byGroup.get(m.group_name) ?? [];
    list.push(div.get(m.id) ?? 0);
    byGroup.set(m.group_name, list);
  }

  const rows: GroupRow[] = [...byGroup].map(([group, scores]) => ({
    group,
    members: scores.length,
    avgDiversity: round1(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
  const order = (a: GroupRow, b: GroupRow) =>
    b.avgDiversity - a.avgDiversity || b.members - a.members || a.group.localeCompare(b.group);

  const ranked = rows.filter((r) => r.members >= MIN_MEMBERS).sort(order).map((r, i) => ({ ...r, rank: i + 1 }));
  const gettingStarted = rows.filter((r) => r.members < MIN_MEMBERS).sort(order);

  const board: Leaderboard = { weekStart: lagosWeekStart(now).toISOString(), ranked, gettingStarted };
  const me = userId == null ? undefined : members.find((m) => m.id === userId);
  if (me) {
    board.you = {
      userId: me.id,
      group: me.group_name,
      diversity: div.get(me.id) ?? 0,
      rank: ranked.find((r) => r.group === me.group_name)?.rank ?? null,
    };
  }
  return board;
}
