"use client";
// 7. Menu board: the cafeteria's dishes, top sellers first, with how easy each is to make plant-based.

import Link from "next/link";
import { useEffect } from "react";
import type { Cafeteria, Convertibility, MenuItem } from "@/lib/types";
import { naira, saveKitchen, useApi } from "@/lib/cafe-client";
import { ArrowRightIcon } from "@/components/icons";
import { EmptyBox, ErrorBox, RISE_CSS, ScreenTitle, SkeletonRows } from "./bits";

const METER: Record<Convertibility, { n: number; label: string; color: string; text: string }> = {
  easy: { n: 3, label: "Easy swap", color: "bg-leaf", text: "text-green-800" },
  medium: { n: 2, label: "Medium", color: "bg-amber-400", text: "text-amber-800" },
  hard: { n: 1, label: "Hard", color: "bg-orange-500", text: "text-orange-800" },
};

export function ConvertMeter({ value }: { value?: Convertibility }) {
  if (!value) return <span className="text-xs font-bold text-stone-500">Needs breakdown</span>;
  const m = METER[value];
  return (
    <span className="flex flex-col items-end gap-1" aria-label={`Convertibility: ${m.label}`}>
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-5 rounded-full ${i <= m.n ? m.color : "bg-stone-200"} ${i === 2 ? "-translate-y-0.5" : ""} ${i === 3 ? "-translate-y-1" : ""}`} />
        ))}
      </span>
      <span className={`text-xs font-black ${m.text}`}>{m.label}</span>
    </span>
  );
}

const mainProtein = (m: MenuItem) => m.breakdown?.find((p) => p.role === "protein")?.label ?? null;

export default function MenuBoard({ slug }: { slug: string }) {
  const { state, retry } = useApi<{ cafeteria: Cafeteria; items: (MenuItem & { convertibility?: Convertibility })[] }>(`/api/cafeterias/${slug}/menu`);
  useEffect(() => saveKitchen(slug), [slug]);

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      {state.status === "loading" && (
        <>
          <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-green-100/70" />
          <SkeletonRows n={5} label="Loading the menu" />
        </>
      )}
      {state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {state.status === "ready" && (
        <>
          <ScreenTitle
            title={state.data.cafeteria.name}
            sub="Your menu, best sellers first. Pick a dish to find a plant-based swap."
            aside={
              <Link href="/kitchen" className="flex min-h-12 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold text-green-800 shadow-sm hover:bg-green-50">
                Switch
              </Link>
            }
          />
          {state.data.items.length === 0 ? (
            <EmptyBox title="No menu yet" body="This cafeteria's menu hasn't been added. Once it is, your dishes show up here, best sellers first." />
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {state.data.items.map((m, i) => {
                const protein = mainProtein(m);
                return (
                  <li key={m.id} className="cf-rise" style={{ animationDelay: `${i * 60}ms` }}>
                    <Link
                      href={`/kitchen/${slug}/${m.id}`}
                      className="group flex min-h-24 items-center gap-3 rounded-[1.75rem_0.6rem] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        {m.isTopSeller && (
                          <span className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900">Top seller</span>
                        )}
                        <span className="block text-lg font-extrabold leading-tight text-green-950">{m.name}</span>
                        <span className="mt-0.5 block text-sm text-stone-600">
                          <b className="text-green-900">{naira(m.priceNgn)}</b>
                          {protein && <> · {protein}</>}
                        </span>
                      </span>
                      <ConvertMeter value={m.convertibility} />
                      <ArrowRightIcon size={18} className="shrink-0 text-green-700/40 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
