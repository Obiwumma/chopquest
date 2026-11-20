import { describe, expect, it } from "vitest";
import { buildLeaderboard, diversityByUser, type Eaten, type Member } from "./leaderboard";

const now = new Date("2026-11-25T12:00:00Z"); // Wednesday; week began Mon 2026-11-23 00:00 WAT = 2026-11-22T23:00Z
const THIS_WEEK = "2026-11-24T08:00:00Z";
const LAST_WEEK = "2026-11-22T22:59:00Z"; // Sunday 23:59 Lagos

// 3 groups, 10 users
const members: Member[] = [
  { id: 1, group_name: "Hall A" },
  { id: 2, group_name: "Hall A" },
  { id: 3, group_name: "Hall A" },
  { id: 4, group_name: "Hall A" },
  { id: 5, group_name: "Hall B" },
  { id: 6, group_name: "Hall B" },
  { id: 7, group_name: "Hall B" },
  { id: 8, group_name: "Microbiology" },
  { id: 9, group_name: "Microbiology" },
  { id: 10, group_name: "Microbiology" },
];
const ate = (user_id: number, groups: string[], created_at = THIS_WEEK): Eaten[] =>
  groups.map((dex_group) => ({ user_id, dex_group, created_at }));

const eaten: Eaten[] = [
  // Hall A: 3, 1, 0, 0 -> avg 1.0
  ...ate(1, ["Beans", "Soy", "Animal", "Beans"]),
  ...ate(2, ["Animal"]),
  // Hall B: 3, 3, 3 -> avg 3.0
  ...ate(5, ["Beans", "Soy", "Groundnut"]),
  ...ate(6, ["Egusi", "Iru", "Animal"]),
  ...ate(7, ["Bambara", "Tigernut", "Mushroom"]),
  // Microbiology: 2, 2, 0 this week (user 10 only ate last week) -> avg 1.3
  ...ate(8, ["Beans", "Animal"]),
  ...ate(9, ["Soy", "Staple", "Pigeon pea"]),
  ...ate(10, ["Beans", "Soy", "Egusi", "Iru"], LAST_WEEK),
];

describe("diversityByUser", () => {
  it("distinct groups this Lagos week, Staple and last week excluded", () => {
    const d = diversityByUser(eaten, now);
    expect(d.get(1)).toBe(3);
    expect(d.get(9)).toBe(2);
    expect(d.has(10)).toBe(false);
  });
});

describe("buildLeaderboard", () => {
  it("ranks 3 groups / 10 users by average diversity over all members", () => {
    const b = buildLeaderboard(members, eaten, now);
    expect(b.ranked).toEqual([
      { group: "Hall B", members: 3, avgDiversity: 3, rank: 1 },
      { group: "Microbiology", members: 3, avgDiversity: 1.3, rank: 2 },
      { group: "Hall A", members: 4, avgDiversity: 1, rank: 3 },
    ]);
    expect(b.gettingStarted).toEqual([]);
    expect(b.weekStart).toBe("2026-11-22T23:00:00.000Z");
  });

  it("groups under 3 members go in Getting started", () => {
    const b = buildLeaderboard([...members, { id: 11, group_name: "Hall C" }, { id: 12, group_name: "Hall C" }], [...eaten, ...ate(11, ["Soy"])], now);
    expect(b.ranked.map((r) => r.group)).toEqual(["Hall B", "Microbiology", "Hall A"]);
    expect(b.gettingStarted).toEqual([{ group: "Hall C", members: 2, avgDiversity: 0.5 }]);
  });

  it("ties: more members first, then name", () => {
    const m: Member[] = [1, 2, 3].map((id) => ({ id, group_name: "Zeta" })).concat([4, 5, 6, 7].map((id) => ({ id, group_name: "Alpha" })), [8, 9, 10].map((id) => ({ id, group_name: "Beta" })));
    expect(buildLeaderboard(m, [], now).ranked.map((r) => r.group)).toEqual(["Alpha", "Beta", "Zeta"]);
  });

  it("resets on Monday: last week's meals don't count", () => {
    const b = buildLeaderboard(members, ate(5, ["Beans", "Soy", "Groundnut"], LAST_WEEK), now);
    expect(b.ranked.every((r) => r.avgDiversity === 0)).toBe(true);
  });

  it("includes your own score and your group's rank", () => {
    expect(buildLeaderboard(members, eaten, now, 1).you).toEqual({ userId: 1, group: "Hall A", diversity: 3, rank: 3 });
    const small = buildLeaderboard([...members, { id: 11, group_name: "Solo" }], eaten, now, 11);
    expect(small.you).toEqual({ userId: 11, group: "Solo", diversity: 0, rank: null });
  });

  it("ranks 10,000 users in well under a second", () => {
    const many: Member[] = Array.from({ length: 10_000 }, (_, i) => ({ id: i, group_name: `Hall ${i % 40}` }));
    const lots: Eaten[] = many.flatMap((m) => ate(m.id, ["Beans", "Soy", "Animal"].slice(0, (m.id % 3) + 1)));
    const t = performance.now();
    const b = buildLeaderboard(many, lots, now);
    expect(performance.now() - t).toBeLessThan(1000);
    expect(b.ranked).toHaveLength(40);
  });
});
