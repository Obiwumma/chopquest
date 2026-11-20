"use client";
// Navigation that grows like a plant, instead of a standard tab bar.
// Phone: a floating seed button; tapping it grows a "garden" of leaf tiles, in two beds.
// Laptop (md+): a vine down the left edge with a leaf per page; the current page is in bloom.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChefIcon, CloseIcon, DexIcon, HomeIcon, LeafIcon, PodiumIcon, ScanIcon, StoreIcon, TrophyIcon, type IconComponent } from "@/components/icons";

type Item = { href: string; label: string; hint: string; Icon: IconComponent };
const BEDS: { name: string; items: Item[] }[] = [
  {
    name: "Campus food",
    items: [
      { href: "/board", label: "Board", hint: "Top plant dishes", Icon: PodiumIcon },
      { href: "/cafeterias", label: "Cafeterias", hint: "Where to eat", Icon: StoreIcon },
      { href: "/kitchen", label: "Kitchen", hint: "For managers", Icon: ChefIcon },
    ],
  },
  {
    name: "My quest",
    items: [
      { href: "/", label: "Home", hint: "You and your pet", Icon: HomeIcon },
      { href: "/scan", label: "Scan", hint: "Snap a meal", Icon: ScanIcon },
      { href: "/dex", label: "Dex", hint: "Proteins found", Icon: DexIcon },
      { href: "/leaderboard", label: "Ranks", hint: "Group league", Icon: TrophyIcon },
    ],
  },
];
const ALL = BEDS.flatMap((b) => b.items);

const isActive = (href: string, path: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

const css = `
@keyframes vn-grow { from { opacity: 0; transform: translateY(18px) scale(.85) rotate(-4deg); } to { opacity: 1; transform: none; } }
@keyframes vn-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes vn-sprout { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.vn-grow { animation: vn-grow .42s cubic-bezier(.2,1.1,.3,1) both; }
.vn-sway { animation: vn-sway 3.6s ease-in-out infinite; transform-origin: 50% 100%; }
.vn-sprout { animation: vn-sprout .35s ease-out both; transform-origin: 50% 100%; }
@media (prefers-reduced-motion: reduce) { .vn-grow, .vn-sway, .vn-sprout { animation: none; } }
`;

export default function VineNav() {
  const path = usePathname();
  const current = ALL.find((i) => isActive(i.href, path)) ?? null;
  return (
    <>
      <style>{css}</style>
      <SeedNav current={current} path={path} />
      <VineRail path={path} />
    </>
  );
}

/* ---------------- Phone: seed button + garden sheet ---------------- */

function SeedNav({ current, path }: { current: Item | null; path: string }) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  const seedRef = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  // Close the garden after navigating (state adjusted during render, not in an effect).
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        seedRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const CurrentIcon = current?.Icon;
  let n = 0;

  return (
    <div className="md:hidden">
      {open && (
        <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-green-950/30 backdrop-blur-[2px]" />
      )}

      {open && (
        <nav
          id="garden"
          aria-label="Main"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 overflow-hidden rounded-[2rem] bg-[#f3fbe9] p-4 shadow-2xl ring-1 ring-green-900/10"
        >
          <svg aria-hidden className="pointer-events-none absolute -right-6 -top-8 w-40 text-green-200" viewBox="0 0 100 100" fill="currentColor">
            <path d="M10 90C10 40 45 10 95 5 90 55 60 90 10 90z" />
          </svg>
          {BEDS.map((bed) => (
            <section key={bed.name} className="relative mb-3 last:mb-0">
              <h2 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-green-800/70">{bed.name}</h2>
              <ul className={`grid gap-2 ${bed.items.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                {bed.items.map((item) => {
                  const active = isActive(item.href, path);
                  const i = n++;
                  return (
                    <li key={item.href} className="vn-grow" style={{ animationDelay: `${i * 45}ms` }}>
                      <Link
                        ref={i === 0 ? firstLink : undefined}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-[1.6rem_0.5rem] px-1 py-2 text-center text-sm font-extrabold transition active:scale-95 ${
                          active ? "bg-leaf text-white shadow-[0_8px_20px_-8px_#15803d]" : "bg-white text-green-900 shadow-sm hover:bg-green-50"
                        }`}
                      >
                        <item.Icon size={24} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      )}

      {/* The seed: current page, tap to open the garden. */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
        <button
          ref={seedRef}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="garden"
          aria-label={open ? "Close menu" : `Menu. You're on ${current?.label ?? "ChopQuest"}`}
          className="pointer-events-auto relative flex h-16 items-center gap-2 rounded-[2rem_2rem_2rem_0.75rem] bg-leaf-dark pl-4 pr-5 text-white shadow-[0_12px_28px_-8px_#14532d] ring-4 ring-[#f3fbe9] transition active:scale-95"
        >
          <span aria-hidden className="absolute -top-3 left-6 h-4 w-0.5 bg-green-700 vn-sprout" />
          <svg aria-hidden className="absolute -top-6 left-5 w-6 text-leaf vn-sway" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22C12 12 6 6 2 6c0 6 4 12 10 16zM12 22c0-8 4-14 10-14 0 6-4 12-10 14z" />
          </svg>
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
            {open ? <CloseIcon size={22} /> : CurrentIcon ? <CurrentIcon size={22} /> : <LeafIcon size={22} />}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-base font-black">{open ? "Close" : current?.label ?? "Menu"}</span>
            <span className="block text-xs font-bold text-white/75">{open ? "Pick a page" : "Tap to explore"}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Laptop: the vine rail ---------------- */

function VineRail({ path }: { path: string }) {
  let i = 0;
  return (
    <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-[#eef8e3]/90 px-4 py-6 backdrop-blur md:flex">
      <Link href="/board" className="mb-6 flex items-center gap-2 px-2">
        <svg aria-hidden viewBox="0 0 32 32" className="size-9">
          <ellipse cx="16" cy="19" rx="11" ry="10" fill="#fdf3dc" stroke="#3b2a1a" strokeWidth="2" />
          <path d="M16 9c0-4 2-6 5-7-1 4-2 6-5 7zM16 9c-1-3-3-4-6-4 1 3 3 4 6 4z" fill="#22c55e" />
          <circle cx="12.5" cy="18" r="1.4" fill="#3b2a1a" /><circle cx="19.5" cy="18" r="1.4" fill="#3b2a1a" />
          <path d="M13.5 22q2.5 2 5 0" stroke="#3b2a1a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
        <span className="text-xl font-black text-green-900">ChopQuest</span>
      </Link>

      {/* the vine */}
      <svg aria-hidden className="pointer-events-none absolute left-[2.15rem] top-24 bottom-10 w-6 text-green-600/40" preserveAspectRatio="none" viewBox="0 0 24 400">
        <path d="M12 0C2 50 22 100 12 150S2 250 12 300 22 370 12 400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="relative flex flex-1 flex-col gap-5 overflow-y-auto">
        {BEDS.map((bed) => (
          <section key={bed.name}>
            <h2 className="mb-2 pl-14 text-xs font-black uppercase tracking-wider text-green-800/60">{bed.name}</h2>
            <ul className="flex flex-col gap-1.5">
              {bed.items.map((item) => {
                const active = isActive(item.href, path);
                const flip = i++ % 2 === 1;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex min-h-12 items-center gap-3 rounded-2xl py-1.5 pr-3 transition ${active ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
                    >
                      <span
                        className={`relative flex size-11 shrink-0 items-center justify-center transition group-hover:scale-105 ${
                          flip ? "rounded-[0.5rem_1.4rem]" : "rounded-[1.4rem_0.5rem]"
                        } ${active ? "bg-leaf text-white shadow-[0_0_0_4px_#bbf7d0,0_8px_18px_-6px_#15803d]" : "bg-white text-green-800 ring-1 ring-green-900/10"}`}
                      >
                        <item.Icon size={21} />
                      </span>
                      <span className="leading-tight">
                        <span className={`block font-extrabold ${active ? "text-green-900" : "text-stone-700"}`}>{item.label}</span>
                        <span className="block text-xs text-stone-500">{item.hint}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="relative mt-4 px-2 text-xs text-stone-500">Protein and price figures are estimates, not medical advice.</p>
    </nav>
  );
}

