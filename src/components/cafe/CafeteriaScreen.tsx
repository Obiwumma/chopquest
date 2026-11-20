"use client";
// 3. One cafeteria: its rank on the board, rating, and its plant-based dishes.

import Link from "next/link";
import type { Cafeteria, CafeteriaRank, PlantDish } from "@/lib/types";
import { naira, useApi } from "@/lib/cafe-client";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RankBadge, RISE_CSS, SkeletonRows, Stars } from "./bits";

export default function CafeteriaScreen({ slug }: { slug: string }) {
  const { state, retry } = useApi<{ cafeteria: Cafeteria; dishes: PlantDish[] }>(`/api/cafeterias/${slug}/plant-dishes`);
  const board = useApi<{ ranked: CafeteriaRank[]; gettingStarted: CafeteriaRank[] }>("/api/board");

  if (state.status === "loading") return <SkeletonRows n={4} label="Loading the cafeteria" />;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;
  const { cafeteria, dishes } = state.data;
  const rankIdx = board.state.status === "ready" ? board.state.data.ranked.findIndex((r) => r.cafeteria.id === cafeteria.id) : -1;
  const stats =
    board.state.status === "ready" ? [...board.state.data.ranked, ...board.state.data.gettingStarted].find((r) => r.cafeteria.id === cafeteria.id) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <Link href="/cafeterias" className="flex min-h-12 w-fit items-center gap-1 rounded-full pr-3 font-bold text-green-800 hover:bg-white/60">
        <ArrowLeftIcon size={20} /> All cafeterias
      </Link>
      <header className="flex items-center gap-4 rounded-[2rem_2rem_2rem_0.75rem] bg-gradient-to-br from-leaf to-leaf-dark p-5 text-white shadow-lg">
        <RankBadge rank={rankIdx >= 0 ? rankIdx + 1 : null} size={60} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black leading-tight">{cafeteria.name}</h1>
          {cafeteria.location && <p className="text-white/80">{cafeteria.location}</p>}
          <p className="mt-1 text-sm font-bold text-white/90">{rankIdx >= 0 ? `#${rankIdx + 1} on the Campus Plant Board` : "Not on the board yet"}</p>
        </div>
        {stats?.avgRating != null && (
          <div className="shrink-0 text-right">
            <p className="text-4xl font-black tabular-nums">{stats.avgRating.toFixed(1)}</p>
            <p className="text-xs font-bold text-white/80">{stats.reviewCount} reviews</p>
          </div>
        )}
      </header>

      <section aria-label="Plant dishes" className="flex flex-col gap-3">
        <h2 className="text-xl font-black text-green-950">Plant dishes</h2>
        {dishes.length === 0 ? (
          <EmptyBox title="No plant dish yet" body="This cafeteria hasn't added a plant dish yet." action={{ href: "/board", label: "See the board" }} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {dishes.map((d, i) => (
              <li key={d.id} className="cf-rise" style={{ animationDelay: `${i * 70}ms` }}>
                <Link href={`/dishes/${d.id}`} className="group flex h-full flex-col gap-2 rounded-[1.75rem_0.6rem] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-lg font-extrabold leading-tight text-green-950">{d.name}</span>
                    <span className="shrink-0 text-lg font-black text-green-900">{naira(d.priceNgn)}</span>
                  </span>
                  <span className="text-sm text-stone-600">~{Math.round(d.proteinG)} g protein (estimate)</span>
                  <span className="mt-auto flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Stars value={d.avgRating} size={16} />
                      <span className="text-sm text-stone-600">
                        {d.reviewCount ? `${d.avgRating?.toFixed(1)} · ${d.reviewCount} ${d.reviewCount === 1 ? "review" : "reviews"}` : "No reviews yet"}
                      </span>
                    </span>
                    <ArrowRightIcon size={18} className="text-green-700/40 transition group-hover:translate-x-0.5" />
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
