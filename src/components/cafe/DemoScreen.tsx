"use client";
// /demo: the kitchen flow with no network. Runs the real swap engine (src/lib/swap.ts) in the
// browser on bundled fixtures; nothing is fetched and nothing is saved.

import { useState } from "react";
import type { DishPart, Food, KitchenCard, SwapLimits, SwapOption } from "@/lib/types";
import { DEFAULT_LIMITS } from "@/lib/types";
import { findSwaps } from "@/lib/swap";
import { naira } from "@/lib/cafe-client";
import { ArrowLeftIcon, SparkIcon } from "@/components/icons";
import foodsJson from "@/data/demo/foods.json";
import fixtures from "@/data/demo/dishes.json";
import { RISE_CSS, ScreenTitle } from "./bits";
import { ChloeWorking } from "./swap/anim";
import BreakdownEditor from "./swap/BreakdownEditor";
import LimitsPanel from "./swap/LimitsPanel";
import SwapResults from "./swap/SwapResults";
import KitchenCardPanel from "./swap/KitchenCardPanel";
import { ConvertMeter } from "./MenuBoard";
import { convertibility } from "@/lib/swap";

const FOODS = foodsJson as Food[];
type Dish = (typeof fixtures.dishes)[number];

// Same template as the kitchen-card API's offline fallback.
function templateCard(dishName: string, option: SwapOption): KitchenCard {
  const added = option.adds.map((a) => `${a.label} (${a.grams} g)`).join(" and ");
  const removed = option.replaces.map((p) => p.label.toLowerCase()).join(" and ");
  const base = dishName.replace(new RegExp(option.replaces.map((p) => p.label).join("|"), "ig"), "").replace(/\b(and|with)\s*$/i, "").trim() || dishName;
  return {
    menuName: `Plant ${base}`.replace(/\s+/g, " "),
    studentBlurb: `Our ${base.toLowerCase()} with ${option.adds.map((a) => a.label.toLowerCase()).join(" and ")} instead of ${removed}.`,
    steps: [
      `Prepare ${base.toLowerCase()} exactly as usual, without the ${removed}.`,
      `Prepare ${added} the way your kitchen usually cooks it.`,
      `Serve it in place of the ${removed}, one portion per plate.`,
    ],
    validated: true,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DemoScreen() {
  const [dish, setDish] = useState<Dish | null>(null);
  const [parts, setParts] = useState<DishPart[]>([]);
  const [limits, setLimits] = useState<SwapLimits>(DEFAULT_LIMITS);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [card, setCard] = useState<{ option: SwapOption; card: KitchenCard } | null>(null);

  function pick(d: Dish) {
    setDish(d);
    setParts(d.breakdown as DishPart[]);
    setOptions(null);
    setCard(null);
  }

  async function run() {
    if (!dish) return;
    setBusy(true);
    setOptions(null);
    setCard(null);
    await wait(1200); // same pacing as the live flow
    setOptions(findSwaps(parts, dish.name, limits, FOODS));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <div className="flex items-center justify-between gap-3 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">
        <span>Demo mode: works offline, nothing is saved.</span>
      </div>

      {!dish ? (
        <>
          <ScreenTitle title={fixtures.cafeteria} sub="Pick a dish to find an alt protein swap." />
          <ul className="grid gap-2 md:grid-cols-3">
            {fixtures.dishes.map((d, i) => (
              <li key={d.id} className="cf-rise" style={{ animationDelay: `${i * 80}ms` }}>
                <button
                  onClick={() => pick(d)}
                  className="flex min-h-24 w-full items-center gap-3 rounded-[1.75rem_0.6rem] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    {d.isTopSeller && <span className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900">Top seller</span>}
                    <span className="block text-lg font-extrabold leading-tight text-green-950">{d.name}</span>
                    <span className="block text-sm font-bold text-green-900">{naira(d.priceNgn)}</span>
                  </span>
                  <ConvertMeter value={convertibility(d.breakdown as DishPart[], d.name, FOODS)} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <header className="flex flex-col gap-2">
            <button onClick={() => setDish(null)} className="flex min-h-12 w-fit items-center gap-1 rounded-full pr-3 font-bold text-green-800 hover:bg-white/60">
              <ArrowLeftIcon size={20} /> {fixtures.cafeteria} menu
            </button>
            <h1 className="text-3xl font-black leading-tight text-green-950 md:text-4xl">{dish.name}</h1>
            <p className="text-stone-600">
              Students pay <b className="text-green-900">{naira(dish.priceNgn)}</b>
            </p>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-black text-green-950">What&apos;s on the plate</h2>
              <BreakdownEditor parts={parts} foods={FOODS} onChange={(p) => { setParts(p); setOptions(null); }} />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-black text-green-950">Your limits</h2>
              <LimitsPanel limits={limits} onChange={(l) => { setLimits(l); setOptions(null); }} />
              <button
                onClick={run}
                disabled={busy || parts.length === 0}
                className="flex min-h-16 items-center justify-center gap-2 rounded-[2rem_2rem_2rem_0.75rem] bg-leaf text-xl font-black text-white shadow-[0_10px_24px_-10px_#15803d] hover:bg-leaf-dark active:scale-[0.98] disabled:opacity-50"
              >
                <SparkIcon size={24} /> Find swaps
              </button>
            </section>
          </div>
          {busy && <ChloeWorking label="Chloe is working out swaps" />}
          {options && options.length === 0 && (
            <p className="rounded-3xl bg-white p-5 font-bold text-red-800 shadow-sm">No swap fits these limits. Loosen one and try again.</p>
          )}
          {options && options.length > 0 && (
            <SwapResults options={options} priceNgn={dish.priceNgn} dishName={dish.name} busyRank={null} onCard={(o) => setCard({ option: o, card: templateCard(dish.name, o) })} />
          )}
          {card && (
            <KitchenCardPanel
              key={card.option.rank}
              card={card.card}
              option={card.option}
              menuItemId={dish.id}
              oldPrice={dish.priceNgn}
              publish={async () => {
                await wait(600);
                return { id: null };
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
