"use client";
// 4. Dish page: what changed, how students rated it, and every review.

import Link from "next/link";
import { useState } from "react";
import type { Cafeteria, KitchenCard, PlantDish, Review, SwapOption } from "@/lib/types";
import { naira, timeAgo, useApi } from "@/lib/cafe-client";
import { ArrowLeftIcon, CheckIcon, StarIcon, SwapIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RISE_CSS, SkeletonRows, Stars } from "./bits";
import ReviewSheet from "./ReviewSheet";

type Data = { dish: PlantDish & { option: SwapOption; card: KitchenCard }; reviews: Review[] };

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export default function DishScreen({ id }: { id: number }) {
  const { state, retry, setData } = useApi<Data>(`/api/plant-dishes/${id}`);
  const cafes = useApi<{ cafeterias: Cafeteria[] }>("/api/cafeterias");
  const [writing, setWriting] = useState(false);
  const [fresh, setFresh] = useState<number | null>(null);

  if (state.status === "loading") return <SkeletonRows n={4} h="h-28" label="Loading the dish" />;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;

  const { dish, reviews } = state.data;
  const cafe = cafes.state.status === "ready" ? cafes.state.data.cafeterias.find((c) => c.id === dish.cafeteriaId) : undefined;
  const o = dish.option;
  const out = list(o.replaces.map((p) => p.label.toLowerCase()));
  const into = list(o.adds.map((a) => a.label.toLowerCase()));

  function onSaved(r: Review) {
    setWriting(false);
    setFresh(r.id);
    setData((d) => {
      const all = [r, ...d.reviews];
      const avg = all.reduce((s, x) => s + x.stars, 0) / all.length;
      const woa = Math.round((all.filter((x) => x.wouldOrderAgain).length / all.length) * 100);
      return { reviews: all, dish: { ...d.dish, reviewCount: all.length, avgRating: Math.round(avg * 10) / 10, wouldOrderAgainPct: woa } };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <header className="flex flex-col gap-2">
        {cafe && (
          <Link href={`/cafeterias/${cafe.slug}`} className="flex min-h-12 w-fit items-center gap-1 rounded-full pr-3 font-bold text-green-800 hover:bg-white/60">
            <ArrowLeftIcon size={20} /> {cafe.name}
          </Link>
        )}
        <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-900">Alt protein</span>
        <h1 className="text-3xl font-black leading-tight text-green-950 md:text-4xl">{dish.name}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
          <b className="text-2xl font-black text-green-900">{naira(dish.priceNgn)}</b>
          <span className="rounded-full bg-white px-3 py-1 font-bold text-green-900 shadow-sm">~{Math.round(dish.proteinG)} g protein (estimate)</span>
        </p>
        {dish.card.studentBlurb && <p className="text-lg text-stone-700">{dish.card.studentBlurb}</p>}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* What changed */}
          <section aria-label="What changed" className="cf-rise rounded-[2rem_0.75rem] bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 font-extrabold text-green-950">
              <SwapIcon size={20} className="text-leaf" />
              <span>{`${out.charAt(0).toUpperCase()}${out.slice(1)} swapped for ${into}`}</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-rose-50 p-3">
                <p className="text-xs font-bold text-rose-900/70">Before</p>
                <p className="text-2xl font-black tabular-nums text-rose-950">{Math.round(o.before.proteinG)} g</p>
                <p className="text-xs text-rose-900/70">protein (estimate)</p>
              </div>
              <div className="rounded-2xl bg-green-50 p-3">
                <p className="text-xs font-bold text-green-900/70">After</p>
                <p className="text-2xl font-black tabular-nums text-green-950">{Math.round(o.after.proteinG)} g</p>
                <p className="text-xs text-green-900/70">protein (estimate)</p>
              </div>
            </div>
            {o.completeProtein && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-black text-green-900">
                <CheckIcon size={14} /> Complete protein
              </p>
            )}
          </section>

          {/* Rating summary */}
          <section aria-label="Rating summary" className="cf-rise flex flex-col gap-3 rounded-[2rem_0.75rem] bg-white p-4 shadow-sm" style={{ animationDelay: "120ms" }}>
            {dish.reviewCount === 0 ? (
              <p className="font-bold text-stone-600">No reviews yet. Be the first to try it.</p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-black tabular-nums text-green-950">{dish.avgRating?.toFixed(1)}</span>
                  <span>
                    <Stars value={dish.avgRating} size={22} />
                    <span className="block text-sm text-stone-600">
                      {dish.reviewCount} {dish.reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </span>
                </div>
                {dish.wouldOrderAgainPct != null && (
                  <div>
                    <p className="flex justify-between text-sm font-extrabold text-green-950">
                      Would order again <span className="tabular-nums">{dish.wouldOrderAgainPct}%</span>
                    </p>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-green-100">
                      <div key={dish.wouldOrderAgainPct} className="cf-fill h-full rounded-full bg-gradient-to-r from-leaf to-lime-400" style={{ width: `${dish.wouldOrderAgainPct}%` }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <button onClick={() => setWriting(true)} className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-pepper text-lg font-black text-white shadow-md hover:bg-orange-600 active:scale-[0.98]">
              <StarIcon size={22} /> Write a review
            </button>
          </section>
        </div>

        {/* Reviews */}
        <section aria-label="Reviews" className="flex flex-col gap-2">
          <h2 className="text-xl font-black text-green-950">What students said</h2>
          {reviews.length === 0 ? (
            <EmptyBox title="No reviews yet" body="Tried it? Your review helps other students decide." />
          ) : (
            <ul className="flex flex-col gap-2">
              {reviews.map((r, i) => (
                <li
                  key={r.id}
                  className={`cf-rise rounded-[1.5rem_0.5rem] p-4 shadow-sm ${r.id === fresh ? "bg-amber-50 ring-2 ring-amber-300" : "bg-white"}`}
                  style={{ animationDelay: r.id === fresh ? "0ms" : `${Math.min(i, 8) * 50}ms` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-full bg-green-100 font-black text-green-900" aria-hidden>
                        {r.nickname.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-extrabold text-green-950">{r.nickname}</span>
                    </span>
                    <span className="text-xs text-stone-500">{timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Stars value={r.stars} size={16} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${r.wouldOrderAgain ? "bg-green-100 text-green-900" : "bg-stone-100 text-stone-700"}`}>
                      {r.wouldOrderAgain ? "Would order again" : "Wouldn't order again"}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-stone-800">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {writing && <ReviewSheet dishId={dish.id} dishName={dish.name} onClose={() => setWriting(false)} onSaved={onSaved} />}
    </div>
  );
}
