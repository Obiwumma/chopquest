"use client";
// "Why put this on your menu": a short read for the manager, not a score sheet. Three beats:
// the money (per plate, then a calculator they can drag), the students (real demand signals), and
// the plate itself. Every number comes from the swap option or /api/menu-items/:id/demand.

import { useState } from "react";
import type { SwapOption } from "@/lib/types";
import { naira, useApi } from "@/lib/cafe-client";
import { DEFAULT_SWITCH_RATE_PCT } from "@/lib/profit";
import { SWITCH_RATE_EXPLAINER } from "@/lib/kitchen-copy";
import { CheckIcon, LeafIcon, StarIcon, StoreIcon } from "@/components/icons";
import { CountUp } from "./anim";

type Demand = {
  asks: number;
  asks7d: number;
  platesPerWeek: number | null;
  cafe: { dishes: number; reviews: number; avgRating: number | null; wouldOrderAgainPct: number | null; plantMeals7d: number };
  campus: { plantMeals7d: number; students7d: number; wouldOrderAgainPct: number | null };
};

const WHY_CSS = `
@keyframes wu-plate { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
.wu-plate { animation: wu-plate .35s cubic-bezier(.2,1.3,.4,1) both; }
@media (prefers-reduced-motion: reduce) { .wu-plate { animation: none; } }
`;

const list = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default function WhyUpgrade({ o, priceNgn, dishName, itemId }: { o: SwapOption; priceNgn: number; dishName: string; itemId?: number }) {
  // The offline demo has no dish id: it shows the money and the plate, without live demand.
  const demand = useApi<Demand>(itemId ? `/api/menu-items/${itemId}/demand` : null);
  const d = demand.state.status === "ready" ? demand.state.data : null;

  const outName = list(o.replaces.map((p) => lower(p.label)));
  const inName = list(o.adds.map((a) => lower(a.label)));
  const before = o.before.costNgn;
  const after = o.after.costNgn;
  const marginBefore = before == null ? null : priceNgn - before;
  const marginAfter = after == null ? null : priceNgn - after;
  const gain = marginBefore != null && marginAfter != null ? marginAfter - marginBefore : null;
  const keptPct = o.before.proteinG > 0 ? Math.round((o.after.proteinG / o.before.proteinG) * 100) : null;

  return (
    <section aria-label="Why put this on your menu" className="flex flex-col gap-4 rounded-[1.75rem_1.75rem_1.75rem_0.6rem] bg-[#f3fbe9] p-4 md:p-5">
      <style>{WHY_CSS}</style>
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-leaf-dark">Why put this on your menu</p>
        <h3 className="mt-1 text-xl font-black leading-snug text-green-950 md:text-2xl">
          {gain != null && gain > 0 ? (
            <>
              Every plate earns you <span className="text-leaf-dark">{naira(gain)} more</span>
              {d && d.asks > 0 ? <>, and {d.asks} students have already asked for it.</> : <>, at the same price students pay today.</>}
            </>
          ) : gain != null ? (
            <>This swap costs a little more per plate, so it pays through new customers, not savings.</>
          ) : (
            <>Students want alt protein options. Add your prices and we can show you the money too.</>
          )}
        </h3>
      </header>

      {/* 1. The money */}
      <article className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 font-black text-green-950">
          <span className="grid size-7 place-items-center rounded-full bg-leaf text-xs text-white">1</span> The money
        </h4>
        {before != null && after != null && marginBefore != null && marginAfter != null && gain != null ? (
          <p className="leading-relaxed text-stone-800">
            Today a plate of <b>{dishName}</b> costs you about <b>{naira(before)}</b> to make and sells for <b>{naira(priceNgn)}</b>, so you keep{" "}
            <b>{naira(marginBefore)}</b>. Swap the {outName} for {inName} and the same plate costs about <b>{naira(after)}</b>. You keep{" "}
            <b>{naira(marginAfter)}</b>:{" "}
            {gain >= 0 ? (
              <b className="text-leaf-dark">{naira(gain)} more on every plate, without touching the price.</b>
            ) : (
              <b className="text-orange-800">{naira(-gain)} less per plate, unless you charge {naira(-gain)} more or it brings in new customers.</b>
            )}
          </p>
        ) : (
          <p className="leading-relaxed text-stone-800">
            We don&apos;t have your price for {list(o.priceMissing) || "one of the foods"} yet, so we can&apos;t show the money for this swap. Add it under your prices and this updates.
          </p>
        )}
        {gain != null && gain > 0 && (itemId == null || d) && <Calculator key={d?.platesPerWeek ?? "guess"} gain={gain} dishName={dishName} plates={d?.platesPerWeek ?? null} />}
      </article>

      {/* 2. The students */}
      {itemId != null && <article className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 font-black text-green-950">
          <span className="grid size-7 place-items-center rounded-full bg-leaf text-xs text-white">2</span> The students
        </h4>
        {demand.state.status === "loading" && <div className="h-20 animate-pulse rounded-2xl bg-white/70" aria-label="Loading demand" />}
        {d && (
          <>
            <p className="leading-relaxed text-stone-800">
              {d.asks > 0 ? (
                <>
                  <b>{d.asks} {d.asks === 1 ? "student has" : "students have"}</b> tapped &quot;Make a plant version&quot; on your {dishName}
                  {d.asks7d > 0 ? <> ({d.asks7d} this week)</> : null}. That&apos;s demand waiting for a dish.{" "}
                </>
              ) : (
                <>No one has asked for a plant {dishName} yet, so you&apos;d be first on campus with it. </>
              )}
              {d.campus.plantMeals7d > 0 && (
                <>
                  Across campus, <b>{d.campus.students7d} students</b> logged <b>{d.campus.plantMeals7d} plant meals</b> in the last 7 days
                  {d.campus.wouldOrderAgainPct != null ? <>, and <b>{d.campus.wouldOrderAgainPct}%</b> of reviewers say they&apos;d order their plant dish again</> : null}.{" "}
                </>
              )}
              Every plant dish you publish gets a quest pointing students to your counter, and shows on the Campus Plant Board.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<LeafIcon size={16} />} value={d.asks} label="asked for this dish" />
              <Stat icon={<StoreIcon size={16} />} value={d.cafe.plantMeals7d} label="plant meals at your counter this week" />
              <Stat icon={<StarIcon size={16} filled />} value={d.cafe.avgRating ?? 0} label={d.cafe.avgRating == null ? "no reviews yet" : `your plant rating (${d.cafe.reviews})`} decimals={d.cafe.avgRating == null ? 0 : 1} />
            </div>
          </>
        )}
        {demand.state.status === "error" && <p className="text-sm text-stone-600">Student demand couldn&apos;t load right now.</p>}
      </article>}

      {/* 3. The plate */}
      <article className="flex flex-col gap-2">
        <h4 className="flex items-center gap-2 font-black text-green-950">
          <span className="grid size-7 place-items-center rounded-full bg-leaf text-xs text-white">{itemId != null ? 3 : 2}</span> The plate
        </h4>
        <p className="leading-relaxed text-stone-800">
          Students still get about <b>{Math.round(o.after.proteinG)} g of protein</b>
          {keptPct != null && <> ({keptPct}% of today&apos;s plate)</>}
          {o.completeProtein ? <>, and it&apos;s a <b>complete protein</b> because it pairs a grain with a legume or uses soy</> : null}.{" "}
          {o.extraPrepMin > 0 ? <>Your kitchen needs about <b>{o.extraPrepMin} extra minutes</b> of prep.</> : <>There&apos;s <b>no extra prep</b>.</>}
        </p>
      </article>

      <details className="group rounded-2xl bg-white/70 p-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-extrabold text-green-950">
          How Chloe scored it ({o.score}/100)
          <span className="text-green-700 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <ul className="mt-1 flex flex-col gap-1">
          {o.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="w-24 shrink-0 font-bold text-stone-600">{r.factor}</span>
              <span className="w-8 shrink-0 text-right font-black tabular-nums text-green-700">+{r.points}</span>
              <span className="text-stone-700">{r.note}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-xs text-stone-500">All figures are estimates from your prices and our market survey.</p>
    </section>
  );
}

function Stat({ icon, value, label, decimals = 0 }: { icon: React.ReactNode; value: number; label: string; decimals?: number }) {
  return (
    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
      <p className="flex items-center gap-1 text-2xl font-black tabular-nums text-green-950">
        <span className="text-leaf-dark">{icon}</span>
        <CountUp value={value} format={(v) => v.toFixed(decimals)} />
      </p>
      <p className="text-xs leading-snug text-stone-600">{label}</p>
    </div>
  );
}

/** Drag plates and switch rate; the week and month update live, and 20 plates show who switches. */
function Calculator({ gain, dishName, plates }: { gain: number; dishName: string; plates: number | null }) {
  const [perWeek, setPerWeek] = useState(plates ?? 100);
  const [rate, setRate] = useState(DEFAULT_SWITCH_RATE_PCT);
  const [explain, setExplain] = useState(false);
  const switched = Math.round((perWeek * rate) / 100);
  const week = switched * gain;
  const lit = Math.round((rate / 100) * 20);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm md:p-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-bold text-stone-700">
          Plates of {dishName} you sell a week <b className="tabular-nums text-green-950">{perWeek}</b>
        </span>
        <input type="range" min={10} max={600} step={10} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className="accent-[#15803d]" />
        {plates == null && <span className="text-xs text-stone-500">A guess. Set your real number in your kitchen setup.</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-bold text-stone-700">
          <span>
            Customers who switch{" "}
            <button type="button" onClick={() => setExplain((x) => !x)} className="ml-1 rounded-full bg-mist px-2 text-xs font-black text-ink" aria-expanded={explain}>
              what&apos;s this?
            </button>
          </span>
          <b className="tabular-nums text-green-950">{rate}%</b>
        </span>
        <input type="range" min={5} max={60} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="accent-[#15803d]" />
        {explain && <span className="rounded-xl bg-mist p-2 text-xs leading-relaxed text-stone-700">{SWITCH_RATE_EXPLAINER}</span>}
      </label>

      <div className="flex flex-wrap gap-1.5" aria-label={`${lit} of every 20 customers switch`}>
        {Array.from({ length: 20 }, (_, i) => (
          <span
            key={`${i}-${i < lit}`}
            className={`wu-plate grid size-6 place-items-center rounded-full ${i < lit ? "bg-leaf text-white" : "bg-stone-200 text-stone-400"}`}
            style={{ animationDelay: `${i * 18}ms` }}
            aria-hidden
          >
            {i < lit ? <CheckIcon size={12} /> : null}
          </span>
        ))}
        <span className="self-center text-xs font-bold text-stone-600">{lit} of every 20 customers</span>
      </div>

      <p className="leading-relaxed text-stone-800">
        That&apos;s about <b>{switched} plant plates a week</b>, worth{" "}
        <b className="text-2xl font-black text-leaf-dark">
          <CountUp key={week} value={week} format={naira} />
        </b>{" "}
        more profit a week, or <b className="text-green-950">{naira(week * 4)}</b> a month.
      </p>
    </div>
  );
}
