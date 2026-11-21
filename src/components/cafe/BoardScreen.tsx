"use client";
// 1. Campus Plant Board: cafeterias ranked by their plant-based dishes, plus top-rated dishes.

import Link from "next/link";
import type { CafeteriaRank, PlantDish } from "@/lib/types";
import { naira, useApi } from "@/lib/cafe-client";
import { ArrowRightIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RankBadge, RISE_CSS, ScreenTitle, SkeletonRows, Stars } from "./bits";
import CampusPulse from "./CampusPulse";

type Board = { ranked: CafeteriaRank[]; gettingStarted: CafeteriaRank[]; topDishes: PlantDish[] };

export default function BoardScreen() {
  const { state, retry } = useApi<Board>("/api/board");

  return (
    <div className="@container flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <ScreenTitle title="Campus Plant Board" sub="Alt protein dishes on campus, rated by students." />
      <CampusPulse />

      {state.status === "loading" && <SkeletonRows n={5} label="Loading the board" />}
      {state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {state.status === "ready" && <BoardBody board={state.data} />}
    </div>
  );
}

function BoardBody({ board }: { board: Board }) {
  const rows = [...board.ranked.map((r, i) => ({ r, rank: i + 1 })), ...board.gettingStarted.map((r) => ({ r, rank: null as number | null }))];
  const names = new Map(rows.map(({ r }) => [r.cafeteria.id, r.cafeteria.name]));
  const anyDishes = rows.some(({ r }) => r.plantDishCount > 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @3xl:items-start">
      <section aria-label="Cafeteria ranking" className="flex min-w-0 flex-col gap-2">
        <ol className="flex flex-col gap-2">
          {rows.map(({ r, rank }, i) => (
            <li key={r.cafeteria.id} className="cf-rise" style={{ animationDelay: `${i * 80}ms` }}>
              <Link
                href={`/cafeterias/${r.cafeteria.slug}`}
                className={`group flex min-h-20 items-center gap-3 rounded-[1.75rem_1.75rem_1.75rem_0.75rem] p-3 pr-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                  rank === 1 ? "bg-gradient-to-r from-amber-50 to-white ring-2 ring-amber-300" : "bg-white"
                }`}
              >
                <span className="w-9 text-center text-4xl font-black tabular-nums text-green-900/20" aria-hidden>
                  {rank ?? ""}
                </span>
                <RankBadge rank={rank} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold text-green-950">{r.cafeteria.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-stone-600">
                    <span>
                      <b className="text-green-800">{r.plantDishCount}</b> plant {r.plantDishCount === 1 ? "dish" : "dishes"}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {r.reviewCount} {r.reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  {r.avgRating != null ? (
                    <>
                      <span className="text-2xl font-black tabular-nums text-green-950">{r.avgRating.toFixed(1)}</span>
                      <Stars value={r.avgRating} size={14} />
                    </>
                  ) : (
                    <span className="text-xs font-bold text-stone-500">Not rated yet</span>
                  )}
                </span>
                <ArrowRightIcon size={18} className="shrink-0 text-green-700/40 transition group-hover:translate-x-0.5 group-hover:text-green-700" />
              </Link>
            </li>
          ))}
        </ol>
        <p className="px-1 text-xs text-stone-500">Ranked by student ratings of alt protein dishes. Cafeterias with few reviews start near 3 stars until more students rate them.</p>
      </section>

      <section aria-label="Top rated dishes this week" className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-black text-green-950">Top rated dishes this week</h2>
        {board.topDishes.length === 0 ? (
          <EmptyBox
            title="No plant dishes rated yet"
            body={anyDishes ? "Be the first to review one." : "Be the first to review one when a cafeteria adds a plant dish."}
            action={{ href: "/cafeterias", label: "See cafeterias" }}
          />
        ) : (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 @3xl:mx-0 @3xl:flex-col @3xl:overflow-visible @3xl:px-0">
            {board.topDishes.map((d, i) => (
              <li key={d.id} className="cf-rise w-64 shrink-0 snap-start @3xl:w-auto" style={{ animationDelay: `${300 + i * 70}ms` }}>
                <Link href={`/dishes/${d.id}`} className="flex h-full flex-col gap-1.5 rounded-[1.5rem_0.5rem] bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.99]">
                  <span className="text-lg font-extrabold leading-tight text-green-950">{d.name}</span>
                  <span className="text-sm text-stone-600">{names.get(d.cafeteriaId) ?? "Cafeteria"}</span>
                  <span className="flex items-center gap-2">
                    <Stars value={d.avgRating} size={16} />
                    <span className="text-sm font-bold tabular-nums">{d.avgRating?.toFixed(1)}</span>
                  </span>
                  <span className="mt-auto flex items-end justify-between pt-1">
                    <span className="text-lg font-black text-green-900">{naira(d.priceNgn)}</span>
                    {d.wouldOrderAgainPct != null && (
                      <span className="text-right text-xs font-bold text-green-800">
                        Would order again
                        <span className="block text-base font-black">{d.wouldOrderAgainPct}%</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
