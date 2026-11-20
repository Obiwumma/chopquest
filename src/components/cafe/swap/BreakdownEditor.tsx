"use client";
// 8a. The dish broken into parts. Each part can be fixed: food (dropdown), grams, role.

import type { DishPart, DishRole, Food } from "@/lib/types";
import { CloseIcon, PlusIcon } from "@/components/icons";

const ROLES: DishRole[] = ["protein", "staple", "soup", "side"];
const ROLE_STYLE: Record<DishRole, string> = {
  protein: "bg-rose-100 text-rose-900",
  staple: "bg-amber-100 text-amber-900",
  soup: "bg-orange-100 text-orange-900",
  side: "bg-lime-100 text-lime-900",
};

export default function BreakdownEditor({ parts, foods, onChange }: { parts: DishPart[]; foods: Food[]; onChange: (p: DishPart[]) => void }) {
  const set = (i: number, patch: Partial<DishPart>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const byGroup = foods.reduce<Record<string, Food[]>>((acc, f) => ((acc[f.type] ??= []).push(f), acc), {});

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {parts.map((p, i) => {
          const food = foods.find((f) => f.id === p.foodId);
          return (
            <li key={i} className="cf-rise rounded-[1.4rem_0.5rem] bg-white p-3 shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Part ${i + 1} name`}
                  value={p.label}
                  onChange={(e) => set(i, { label: e.target.value })}
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 text-base font-extrabold text-green-950 focus:border-leaf focus:outline-none"
                />
                <label className="flex min-h-12 items-center rounded-xl border border-stone-200 bg-stone-50 pr-3 focus-within:border-leaf">
                  <input
                    aria-label={`${p.label || "Part"} grams`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={2000}
                    value={p.grams || ""}
                    onChange={(e) => set(i, { grams: Number(e.target.value) })}
                    className="w-16 bg-transparent px-2 text-right text-base font-black tabular-nums focus:outline-none"
                  />
                  <span className="text-sm font-bold text-stone-500">g</span>
                </label>
                <button
                  type="button"
                  onClick={() => onChange(parts.filter((_, j) => j !== i))}
                  aria-label={`Remove ${p.label || "part"}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-700"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <select
                  aria-label={`${p.label || "Part"}: which food`}
                  value={p.foodId ?? ""}
                  onChange={(e) => set(i, { foodId: e.target.value ? Number(e.target.value) : null })}
                  className={`min-h-12 w-full min-w-0 rounded-xl border px-3 text-sm font-bold ${food ? "border-stone-200 bg-white" : "border-amber-300 bg-amber-50 text-amber-900"}`}
                >
                  <option value="">Not matched: pick a food</option>
                  {Object.entries(byGroup).map(([type, list]) => (
                    <optgroup key={type} label={type}>
                      {list.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.food}
                          {f.local_name ? ` (${f.local_name})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={`${p.label || "Part"} role`}>
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={p.role === r}
                      onClick={() => set(i, { role: r })}
                      className={`min-h-12 rounded-xl px-2.5 text-xs font-black capitalize transition ${p.role === r ? ROLE_STYLE[r] + " ring-2 ring-current" : "bg-stone-100 text-stone-500"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...parts, { foodId: null, label: "", grams: 100, role: "side" }])}
        className="flex min-h-12 items-center justify-center gap-2 rounded-[1.4rem_0.5rem] border-2 border-dashed border-green-300 font-bold text-green-800 hover:bg-green-50"
      >
        <PlusIcon size={20} /> Add a part
      </button>
    </div>
  );
}
