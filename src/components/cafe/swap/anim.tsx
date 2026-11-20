"use client";
import { useEffect, useState } from "react";

/** Counts from 0 to `target` (eased). Jumps straight there when the user asks for less motion. */
export function useCountUp(target: number, ms = 900, delay = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() + (reduce ? 0 : delay);
    const tick = (t: number) => {
      const p = reduce ? 1 : Math.min(1, Math.max(0, (t - start) / ms));
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return n;
}

export function CountUp({ value, format = (v) => String(Math.round(v)), delay = 0 }: { value: number; format?: (v: number) => string; delay?: number }) {
  const n = useCountUp(value, 900, delay);
  return <span className="tabular-nums">{format(n)}</span>;
}

/** Score out of 100 as a ring that fills. */
export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const n = useCountUp(score, 1100, 150);
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#dcfce7" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - n / 100)} />
      </svg>
      <span className="text-center leading-none">
        <span className="block font-black tabular-nums text-green-950" style={{ fontSize: size * 0.3 }}>{Math.round(n)}</span>
        <span className="block text-[10px] font-bold text-stone-500">/ 100</span>
      </span>
    </span>
  );
}

/** Scanner-style wait animation while Chloe works. */
export function ChloeWorking({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-[2rem] bg-green-950 p-6 text-white">
      <style>{`
        @keyframes cw-sweep { 0% { transform: translateY(0); opacity: 0; } 10%,90% { opacity: 1; } 100% { transform: translateY(8.5rem); opacity: 0; } }
        @keyframes cw-glint { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        .cw-sweep { animation: cw-sweep 1.6s cubic-bezier(.65,0,.35,1) infinite; }
        .cw-glint { animation: cw-glint 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cw-sweep, .cw-glint { animation: none; } }
      `}</style>
      <div className="relative size-36 overflow-hidden rounded-3xl bg-green-900">
        <svg viewBox="0 0 100 100" className="cw-glint absolute inset-0" aria-hidden>
          <path d="M8 24V8h16M76 8h16v16M92 76v16H76M24 92H8V76" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <path d="M50 78V48M50 56C50 44 40 36 30 36c0 10 8 20 20 20zM50 50c0-10 8-18 20-18 0 10-8 18-20 18z" fill="#4ade80" stroke="#86efac" strokeWidth="1.5" />
        </svg>
        <div aria-hidden className="cw-sweep absolute inset-x-3 top-2 h-1 rounded-full bg-green-400 shadow-[0_0_14px_4px_#4ade80]" />
      </div>
      <p className="text-lg font-black">{label}</p>
    </div>
  );
}
