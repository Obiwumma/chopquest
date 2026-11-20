"use client";
// 8 to 10 on one page: breakdown -> limits -> Find swaps -> top 3 -> kitchen card -> publish.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Cafeteria, DishPart, Food, KitchenCard, MenuItem, SwapLimits, SwapOption } from "@/lib/types";
import { DEFAULT_LIMITS } from "@/lib/types";
import { naira, postJson, useApi } from "@/lib/cafe-client";
import { ArrowLeftIcon, SparkIcon } from "@/components/icons";
import { ErrorBox, RISE_CSS, SkeletonRows } from "../bits";
import { ChloeWorking } from "./anim";
import BreakdownEditor from "./BreakdownEditor";
import LimitsPanel from "./LimitsPanel";
import SwapResults from "./SwapResults";
import KitchenCardPanel from "./KitchenCardPanel";

type Menu = { cafeteria: Cafeteria; items: MenuItem[] };
type Phase = { s: "idle" } | { s: "busy"; label: string } | { s: "error"; message: string };

const partsValid = (p: DishPart[]) => p.length > 0 && p.every((x) => x.label.trim() && x.grams > 0 && x.grams <= 2000);

export default function DishWorkbench({ slug, itemId }: { slug: string; itemId: number }) {
  const menu = useApi<Menu>(`/api/cafeterias/${slug}/menu`);
  const foodsApi = useApi<{ foods: Food[] }>("/api/foods");
  const item = menu.state.status === "ready" ? menu.state.data.items.find((m) => m.id === itemId) ?? null : null;

  const [parts, setParts] = useState<DishPart[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [limits, setLimits] = useState<SwapLimits>(DEFAULT_LIMITS);
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [cardFor, setCardFor] = useState<{ option: SwapOption; card: KitchenCard } | null>(null);
  const [cardBusy, setCardBusy] = useState<number | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Take the saved breakdown when the menu arrives (adjusting state during render, once).
  if (item && parts === null && item.breakdown?.length) setParts(item.breakdown);

  useEffect(() => {
    if (options) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [options]);
  useEffect(() => {
    if (cardFor) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [cardFor]);

  async function runBreakdown() {
    setPhase({ s: "busy", label: "Chloe is breaking the dish down" });
    try {
      const { breakdown } = await postJson<{ breakdown: DishPart[] }>(`/api/menu-items/${itemId}/breakdown`, {});
      setParts(breakdown);
      setAiNote("Chloe's estimate. Fix anything that looks wrong before finding swaps.");
      setPhase({ s: "idle" });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "ai_not_ready") {
        setParts([{ foodId: null, label: "", grams: 250, role: "staple" }, { foodId: null, label: "", grams: 120, role: "protein" }]);
        setDirty(true);
        setAiNote(err.message);
        setPhase({ s: "idle" });
      } else setPhase({ s: "error", message: err.message });
    }
  }

  async function findSwaps() {
    if (!parts) return;
    setOptions(null);
    setCardFor(null);
    try {
      if (dirty) {
        setPhase({ s: "busy", label: "Saving your breakdown" });
        const { breakdown } = await postJson<{ breakdown: DishPart[] }>(`/api/menu-items/${itemId}/breakdown`, { parts });
        setParts(breakdown);
        setDirty(false);
      }
      setPhase({ s: "busy", label: "Chloe is working out swaps" });
      const [{ options }] = await Promise.all([
        postJson<{ options: SwapOption[] }>(`/api/menu-items/${itemId}/swaps`, limits),
        new Promise((r) => setTimeout(r, 900)), // let the animation read as work, not a flicker
      ]);
      setOptions(options);
      setPhase({ s: "idle" });
    } catch (e) {
      setPhase({ s: "error", message: (e as Error).message });
    }
  }

  async function makeCard(option: SwapOption) {
    setCardBusy(option.rank);
    setCardError(null);
    try {
      const { card } = await postJson<{ card: KitchenCard }>("/api/swaps/kitchen-card", { menuItemId: itemId, option });
      setCardFor({ option, card });
    } catch (e) {
      setCardError((e as Error).message);
    } finally {
      setCardBusy(null);
    }
  }

  if (menu.state.status === "loading" || foodsApi.state.status === "loading") return <SkeletonRows n={4} label="Loading the dish" />;
  if (menu.state.status === "error") return <ErrorBox message={menu.state.message} onRetry={menu.retry} />;
  if (foodsApi.state.status === "error") return <ErrorBox message={foodsApi.state.message} onRetry={foodsApi.retry} />;
  if (!item) return <ErrorBox message="This dish isn't on the menu any more." />;
  const foods = foodsApi.state.status === "ready" ? foodsApi.state.data.foods : [];
  const busy = phase.s === "busy";

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE_CSS}</style>
      <header className="flex flex-col gap-2">
        <Link href={`/kitchen/${slug}`} className="flex min-h-12 w-fit items-center gap-1 rounded-full pr-3 font-bold text-green-800 hover:bg-white/60">
          <ArrowLeftIcon size={20} /> {menu.state.data.cafeteria.name} menu
        </Link>
        <h1 className="text-3xl font-black leading-tight text-green-950 md:text-4xl">{item.name}</h1>
        <p className="text-stone-600">
          Students pay <b className="text-green-900">{naira(item.priceNgn)}</b>
          {item.isTopSeller && " · Top seller"}
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="bd" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-2">
            <h2 id="bd" className="text-xl font-black text-green-950">What&apos;s on the plate</h2>
            {parts && <span className="text-xs text-stone-500">Grams are estimates</span>}
          </div>
          {aiNote && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{aiNote}</p>}
          {parts ? (
            <BreakdownEditor
              parts={parts}
              foods={foods}
              onChange={(p) => {
                setParts(p);
                setDirty(true);
                setOptions(null);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={runBreakdown}
              disabled={busy}
              className="flex min-h-16 items-center justify-center gap-2 rounded-[1.6rem_0.5rem] bg-white font-black text-green-900 shadow-sm ring-2 ring-dashed ring-green-300 hover:bg-green-50 disabled:opacity-60"
            >
              <SparkIcon size={22} /> Break it down with Chloe
            </button>
          )}
        </section>

        <section aria-labelledby="lim" className="flex flex-col gap-3">
          <h2 id="lim" className="text-xl font-black text-green-950">Your limits</h2>
          <LimitsPanel limits={limits} onChange={(l) => { setLimits(l); setOptions(null); }} />
          <button
            type="button"
            onClick={findSwaps}
            disabled={busy || !parts || !partsValid(parts)}
            className="flex min-h-16 items-center justify-center gap-2 rounded-[2rem_2rem_2rem_0.75rem] bg-leaf text-xl font-black text-white shadow-[0_10px_24px_-10px_#15803d] transition hover:bg-leaf-dark active:scale-[0.98] disabled:opacity-50"
          >
            <SparkIcon size={24} /> Find swaps
          </button>
          {parts && !partsValid(parts) && <p className="text-sm font-bold text-amber-800">Give every part a name and grams first.</p>}
        </section>
      </div>

      <div ref={resultsRef} className="scroll-mt-6">
        {phase.s === "busy" && <ChloeWorking label={phase.label} />}
        {phase.s === "error" && <ErrorBox message={phase.message} onRetry={() => setPhase({ s: "idle" })} />}
        {options && options.length === 0 && (
          <ErrorBox message="No swap fits these limits. Try a higher cost limit, keeping less protein, or turning off 'Keep it the same dish'." />
        )}
        {options && options.length > 0 && (
          <SwapResults options={options} priceNgn={item.priceNgn} onCard={makeCard} busyRank={cardBusy} />
        )}
        {cardError && <p role="alert" className="mt-2 font-bold text-red-800">{cardError}</p>}
      </div>

      <div ref={cardRef} className="scroll-mt-6">
        {cardFor && <KitchenCardPanel key={cardFor.option.rank} card={cardFor.card} option={cardFor.option} menuItemId={itemId} oldPrice={item.priceNgn} />}
      </div>
    </div>
  );
}
