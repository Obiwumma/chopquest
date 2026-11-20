"use client";
// 10. Kitchen card + publish to the public board.

import Link from "next/link";
import { useState } from "react";
import type { KitchenCard, SwapOption } from "@/lib/types";
import { postJson } from "@/lib/cafe-client";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

export default function KitchenCardPanel({ card, option, menuItemId, oldPrice }: { card: KitchenCard; option: SwapOption; menuItemId: number; oldPrice: number }) {
  const [price, setPrice] = useState(String(oldPrice));
  const [state, setState] = useState<{ s: "idle" | "busy" | "done"; error?: string; id?: number }>({ s: "idle" });

  async function publish() {
    setState({ s: "busy" });
    try {
      const { id } = await postJson<{ id: number }>("/api/plant-dishes", { menuItemId, option, card, priceNgn: Number(price) });
      setState({ s: "done", id });
    } catch (e) {
      setState({ s: "idle", error: (e as Error).message });
    }
  }

  return (
    <section aria-label="Kitchen card" className="cf-rise flex flex-col gap-4 rounded-[2rem_0.75rem] bg-white p-5 shadow-md ring-1 ring-green-900/10 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-leaf-dark">Kitchen card</p>
          <h2 className="text-2xl font-black text-green-950">{card.menuName}</h2>
        </div>
        {card.validated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-900">
            <CheckIcon size={16} /> Checked against our food list
          </span>
        )}
      </header>
      <p className="rounded-2xl bg-[#f3fbe9] p-3 text-green-950">
        <span className="block text-xs font-black uppercase tracking-wide text-green-800/70">For students</span>
        {card.studentBlurb}
      </p>
      <ol className="flex flex-col gap-2">
        {card.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf font-black text-white">{i + 1}</span>
            <span className="pt-1 text-stone-800">{s}</span>
          </li>
        ))}
      </ol>

      {state.s === "done" ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-green-50 p-5 text-center" role="status">
          <svg viewBox="0 0 52 52" className="cf-pop size-16" aria-hidden>
            <circle cx="26" cy="26" r="24" fill="#16a34a" />
            <path d="M14 27l8 8 16-17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" className="cq-draw" />
          </svg>
          <style>{`@keyframes cq-draw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } } .cq-draw { animation: cq-draw .6s .25s ease-out both; } @media (prefers-reduced-motion: reduce) { .cq-draw { animation: none; } }`}</style>
          <p className="text-xl font-black text-green-950">Published to the board</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/dishes/${state.id}`} className="flex min-h-12 items-center gap-2 rounded-full bg-leaf px-5 font-black text-white hover:bg-leaf-dark">
              See it on the board <ArrowRightIcon size={18} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-extrabold text-green-950">Student price</span>
            <span className="flex min-h-12 items-center rounded-xl border border-stone-200 bg-stone-50 px-3 focus-within:border-leaf">
              <span className="font-black text-stone-500">₦</span>
              <input type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="min-w-0 flex-1 bg-transparent px-2 text-lg font-black focus:outline-none" />
            </span>
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={state.s === "busy" || !(Number(price) > 0)}
            className="min-h-12 rounded-full bg-pepper px-6 text-lg font-black text-white shadow-md transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
          >
            {state.s === "busy" ? "Publishing..." : "Publish to the board"}
          </button>
        </div>
      )}
      {state.error && <p role="alert" className="font-bold text-red-800">{state.error}</p>}
    </section>
  );
}
