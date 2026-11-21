"use client";
// 2. Cafeterias: the campus list, with how many plant dishes each serves and their rating.

import Link from "next/link";
import type { CafeteriaRank } from "@/lib/types";
import { useApi } from "@/lib/cafe-client";
import { ArrowRightIcon, StoreIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RISE_CSS, ScreenTitle, SkeletonRows, Stars } from "./bits";

type Board = { ranked: CafeteriaRank[]; gettingStarted: CafeteriaRank[] };
const TINTS = ["#dcfce7", "#fef3c7", "#ecfccb", "#ffedd5", "#e0f2fe"];

export default function CafeteriasScreen() {
  const { state, retry } = useApi<Board>("/api/board");
  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <ScreenTitle title="Cafeterias" sub="Where to eat on campus, and how their alt protein dishes are rated." />
      {state.status === "loading" && <SkeletonRows n={5} label="Loading cafeterias" />}
      {state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {state.status === "ready" && (() => {
        const rows = [...state.data.ranked.map((r, i) => ({ r, rank: i + 1 })), ...state.data.gettingStarted.map((r) => ({ r, rank: null as number | null }))].sort((a, b) =>
          a.r.cafeteria.name.localeCompare(b.r.cafeteria.name),
        );
        if (rows.length === 0) return <EmptyBox title="No cafeterias yet" body="Cafeterias appear here once they join ChopQuest." />;
        return (
          <ul className="flex flex-col divide-y divide-green-900/10 overflow-hidden rounded-[2rem_0.75rem] bg-white shadow-sm">
            {rows.map(({ r, rank }, i) => (
              <li key={r.cafeteria.id} className="cf-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <Link href={`/cafeterias/${r.cafeteria.slug}`} className="group flex min-h-20 items-center gap-4 p-4 transition hover:bg-green-50/60 active:bg-green-50">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-[1.6rem_0.5rem] text-green-900" style={{ background: TINTS[i % TINTS.length] }}>
                    <StoreIcon size={28} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-extrabold text-green-950">{r.cafeteria.name}</span>
                    {r.cafeteria.location && <span className="block text-sm text-stone-600">{r.cafeteria.location}</span>}
                    <span className="mt-0.5 block text-sm text-stone-600">
                      <b className="text-green-800">{r.plantDishCount}</b> plant {r.plantDishCount === 1 ? "dish" : "dishes"}
                      {rank && <> · #{rank} on the board</>}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    {r.avgRating != null ? (
                      <>
                        <span className="text-xl font-black tabular-nums text-green-950">{r.avgRating.toFixed(1)}</span>
                        <Stars value={r.avgRating} size={13} />
                      </>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">Not rated yet</span>
                    )}
                  </span>
                  <ArrowRightIcon size={18} className="shrink-0 text-green-700/40 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        );
      })()}
    </div>
  );
}
