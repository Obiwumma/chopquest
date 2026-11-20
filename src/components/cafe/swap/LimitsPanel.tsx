"use client";
// 8b. The manager's limits for the swap engine.

import type { SwapLimits } from "@/lib/types";

const PREP = [0, 15, 30];

export default function LimitsPanel({ limits, onChange }: { limits: SwapLimits; onChange: (l: SwapLimits) => void }) {
  const set = (patch: Partial<SwapLimits>) => onChange({ ...limits, ...patch });
  return (
    <div className="grid gap-4 rounded-[2rem_0.75rem] bg-[#f3fbe9] p-4 ring-1 ring-green-900/10 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-extrabold text-green-950">Max cost per plate</span>
        <span className="flex min-h-12 items-center rounded-xl border border-stone-200 bg-white px-3 focus-within:border-leaf">
          <span className="font-black text-stone-500">₦</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="No limit"
            value={limits.maxCostPerPlateNgn ?? ""}
            onChange={(e) => set({ maxCostPerPlateNgn: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="min-w-0 flex-1 bg-transparent px-2 text-base font-bold focus:outline-none"
          />
        </span>
        <span className="text-xs text-stone-500">What the new protein may cost per plate (estimate). Leave empty for no limit.</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between font-extrabold text-green-950">
          Keep at least
          <span className="text-2xl font-black tabular-nums text-leaf-dark">{limits.minProteinKeptPct}%</span>
        </span>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={limits.minProteinKeptPct}
          onChange={(e) => set({ minProteinKeptPct: Number(e.target.value) })}
          className="h-12 w-full accent-[#16a34a]"
          aria-valuetext={`${limits.minProteinKeptPct}% of the protein`}
        />
        <span className="text-xs text-stone-500">of the dish&apos;s protein (estimate)</span>
      </label>

      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-extrabold text-green-950">Keep it the same dish</span>
          <span className="block text-xs text-stone-500">Only add foods that fit this dish</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={limits.keepDishIdentity}
          aria-label="Keep it the same dish"
          onClick={() => set({ keepDishIdentity: !limits.keepDishIdentity })}
          className={`relative h-12 w-20 shrink-0 rounded-full transition ${limits.keepDishIdentity ? "bg-leaf" : "bg-stone-300"}`}
        >
          <span className={`absolute top-1.5 size-9 rounded-full bg-white shadow transition-all ${limits.keepDishIdentity ? "left-[2.6rem]" : "left-1.5"}`} />
        </button>
      </div>

      <div>
        <span className="mb-1.5 block font-extrabold text-green-950">Max extra prep time</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Max extra prep time">
          {PREP.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={limits.maxExtraPrepMin === m}
              onClick={() => set({ maxExtraPrepMin: m })}
              className={`min-h-12 flex-1 rounded-full text-sm font-black transition ${limits.maxExtraPrepMin === m ? "bg-leaf text-white shadow" : "bg-white text-green-900 ring-1 ring-green-900/10"}`}
            >
              {m === 0 ? "None" : `${m} min`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
