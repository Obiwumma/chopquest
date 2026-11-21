"use client";
// The front door: pick your side. Students join the Chop Squad (eat plant dishes, scan, grow the pet,
// climb the leaderboard). Restaurant managers go to the Kitchen (profit, where to buy, publish dishes).
// The two sides have separate menus; the choice is remembered on this device and can be switched any time.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, ChefIcon, LeafIcon } from "@/components/icons";

export type Side = "squad" | "kitchen";
const KEY = "cq_side";

export function rememberSide(side: Side) {
  try {
    localStorage.setItem(KEY, side);
  } catch {
    /* private mode: just don't remember */
  }
}

function lastSide(): Side | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "squad" || v === "kitchen" ? v : null;
  } catch {
    return null;
  }
}

const css = `
@keyframes sp-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes sp-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.sp-rise { animation: sp-rise .5s cubic-bezier(.2,1,.3,1) both; }
.sp-sway { animation: sp-sway 3.8s ease-in-out infinite; transform-origin: 50% 100%; }
@media (prefers-reduced-motion: reduce) { .sp-rise, .sp-sway { animation: none; } }
`;

const SIDES: {
  side: Side;
  href: string;
  name: string;
  who: string;
  pitch: string;
  points: string[];
  cta: string;
  Icon: typeof LeafIcon;
  card: string;
  badge: string;
}[] = [
  {
    side: "squad",
    href: "/home",
    name: "Chop Squad",
    who: "For students",
    pitch: "Eat the plant dishes on campus and make every plate count.",
    points: ["Find plant dishes at your cafeterias", "Scan your plate to log it", "Grow your pet and fill your inventory", "Lift your hall up the leaderboard"],
    cta: "Join the Chop Squad",
    Icon: LeafIcon,
    card: "bg-gradient-to-br from-leaf to-leaf-dark text-white shadow-[0_18px_40px_-16px_#14532d]",
    badge: "bg-white/15 text-white",
  },
  {
    side: "kitchen",
    href: "/kitchen",
    name: "Kitchen",
    who: "For restaurant managers",
    pitch: "Swap meat for alt proteins and see what it does to your profit.",
    points: ["Your best alternative proteins", "Profit per plate and per week", "Where to buy, on campus and in Bwari", "Publish plant dishes for students"],
    cta: "Open my kitchen",
    Icon: ChefIcon,
    card: "bg-white text-green-950 ring-2 ring-green-900/10 shadow-[0_18px_40px_-20px_#14532d]",
    badge: "bg-green-50 text-green-800",
  },
];

export default function SidePicker() {
  const [last, setLast] = useState<Side | null>(null);
  useEffect(() => {
    // localStorage only exists in the browser: read it after the first paint.
    const id = requestAnimationFrame(() => setLast(lastSide()));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#f3fbe9]">
      <style>{css}</style>
      <svg aria-hidden className="pointer-events-none absolute -right-16 -top-20 w-72 text-green-200/70" viewBox="0 0 100 100" fill="currentColor">
        <path d="M10 90C10 40 45 10 95 5 90 55 60 90 10 90z" />
      </svg>
      <svg aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 w-80 text-green-200/50" viewBox="0 0 100 100" fill="currentColor">
        <path d="M90 90C90 40 55 10 5 5c5 50 35 85 85 85z" />
      </svg>

      <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 px-4 py-10 md:px-8">
        <header className="sp-rise flex flex-col items-center gap-3 text-center">
          <svg aria-hidden viewBox="0 0 32 32" className="size-16 sp-sway">
            <ellipse cx="16" cy="19" rx="11" ry="10" fill="#fdf3dc" stroke="#3b2a1a" strokeWidth="2" />
            <path d="M16 9c0-4 2-6 5-7-1 4-2 6-5 7zM16 9c-1-3-3-4-6-4 1 3 3 4 6 4z" fill="#22c55e" />
            <circle cx="12.5" cy="18" r="1.4" fill="#3b2a1a" />
            <circle cx="19.5" cy="18" r="1.4" fill="#3b2a1a" />
            <path d="M13.5 22q2.5 2 5 0" stroke="#3b2a1a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </svg>
          <h1 className="text-4xl font-black tracking-tight text-green-950 md:text-5xl">ChopQuest</h1>
          <p className="text-lg font-bold text-green-800">Keep your jollof, upgrade your protein.</p>
          <p className="text-stone-700">Who&apos;s here today?</p>
        </header>

        <ul className="grid gap-4 md:grid-cols-2">
          {SIDES.map((s, i) => (
            <li key={s.side} className="sp-rise" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <Link
                href={s.href}
                onClick={() => rememberSide(s.side)}
                className={`group flex h-full flex-col gap-4 rounded-[2.2rem_2.2rem_2.2rem_0.8rem] p-6 transition hover:-translate-y-1 active:scale-[0.99] ${s.card}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={`flex size-14 items-center justify-center rounded-[1.6rem_0.5rem] ${s.badge}`}>
                    <s.Icon size={28} />
                  </span>
                  {last === s.side && <span className={`rounded-full px-3 py-1 text-sm font-bold ${s.badge}`}>Last time</span>}
                </span>
                <span>
                  <span className="block text-sm font-bold opacity-80">{s.who}</span>
                  <span className="block text-3xl font-black">{s.name}</span>
                  <span className="mt-1 block text-base font-semibold opacity-90">{s.pitch}</span>
                </span>
                <ul className="flex flex-col gap-1.5 text-sm font-semibold opacity-90">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto flex min-h-12 items-center justify-between gap-2 border-t border-current/15 pt-4 text-lg font-black">
                  {s.cta}
                  <ArrowRightIcon size={22} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="sp-rise text-center text-sm text-stone-600" style={{ animationDelay: "320ms" }}>
          You can switch sides any time from the menu. The Kitchen needs your cafeteria&apos;s code.
        </p>
      </div>
    </div>
  );
}
