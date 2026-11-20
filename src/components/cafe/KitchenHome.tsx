"use client";
// 6. Kitchen home: the manager picks their cafeteria once; the choice is remembered.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Cafeteria } from "@/lib/types";
import { loadKitchen, saveKitchen, useApi } from "@/lib/cafe-client";
import { ArrowRightIcon, ChefIcon, StoreIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RISE_CSS, ScreenTitle, SkeletonRows } from "./bits";

export default function KitchenHome() {
  const { state, retry } = useApi<{ cafeterias: Cafeteria[] }>("/api/cafeterias");
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    // localStorage only exists in the browser; read it after hydration.
    const id = requestAnimationFrame(() => setSaved(loadKitchen()));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <ScreenTitle
        title="Kitchen"
        sub="For cafeteria managers: find plant-based swaps for your best sellers, at the same cost or less."
        aside={
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-[1.6rem_0.5rem] bg-leaf text-white sm:flex">
            <ChefIcon size={28} />
          </span>
        }
      />

      {state.status === "loading" && <SkeletonRows n={5} h="h-16" label="Loading cafeterias" />}
      {state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {state.status === "ready" &&
        (state.data.cafeterias.length === 0 ? (
          <EmptyBox title="No cafeterias yet" body="Cafeterias appear here once they're added to ChopQuest." />
        ) : (
          <section aria-labelledby="which" className="flex flex-col gap-3">
            {(() => {
              const mine = state.data.cafeterias.find((c) => c.slug === saved);
              return mine ? (
                <Link
                  href={`/kitchen/${mine.slug}`}
                  className="cf-rise flex min-h-20 items-center gap-4 rounded-[2rem_2rem_2rem_0.75rem] bg-gradient-to-br from-leaf to-leaf-dark p-4 text-white shadow-lg active:scale-[0.99]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
                    <StoreIcon size={26} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-white/80">Continue as</span>
                    <span className="block text-2xl font-black">{mine.name}</span>
                  </span>
                  <ArrowRightIcon size={24} />
                </Link>
              ) : null;
            })()}
            <h2 id="which" className="text-xl font-black text-green-950">
              {saved ? "Or switch cafeteria" : "Which cafeteria are you?"}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {state.data.cafeterias.map((c, i) => (
                <li key={c.id} className="cf-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link
                    href={`/kitchen/${c.slug}`}
                    onClick={() => saveKitchen(c.slug)}
                    aria-current={c.slug === saved ? "true" : undefined}
                    className={`flex min-h-16 items-center gap-3 rounded-[1.4rem_0.5rem] p-3 shadow-sm transition hover:-translate-y-0.5 active:scale-[0.99] ${
                      c.slug === saved ? "bg-green-50 ring-2 ring-leaf" : "bg-white"
                    }`}
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-green-100 text-green-800">
                      <StoreIcon size={22} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold text-green-950">{c.name}</span>
                      {c.location && <span className="block text-sm text-stone-600">{c.location}</span>}
                    </span>
                    <ArrowRightIcon size={18} className="text-green-700/50" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
