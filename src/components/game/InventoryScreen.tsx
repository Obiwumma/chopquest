"use client";
// Inventory: the student's protein slots (filled by real scans), their meal records, and a diet chart
// with a plain-words analysis. Data comes from /api/me/diet, which reads the sign-in cookie.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Diet, DietMeal, DayBar, Insight } from "@/lib/diet";
import { restoreSession, type User } from "@/lib/user";
import DexGrid from "./DexGrid";
import { CheckIcon, LeafIcon, ScanIcon, SparkIcon } from "@/components/icons";

type Data = { user: User; meals: DietMeal[]; diet: Diet };
type State = { status: "loading" } | { status: "signed-out" } | { status: "error"; message: string } | { status: "ready"; data: Data };
type Tab = "inventory" | "records" | "diet";

// Validated palette (dataviz validator: CVD and normal-vision separation pass). Gold is under 3:1 on
// the surface, so the chart always has a legend, hover values and the records table beside it.
const SERIES = [
  { key: "plant", label: "Plant", color: "#15803d" },
  { key: "alternative", label: "Soy and mushroom", color: "#d4a017" },
  { key: "animal", label: "Animal", color: "#c2410c" },
] as const;
const TYPE_COLOR: Record<string, string> = { Plant: "#15803d", Alternative: "#d4a017", Animal: "#c2410c", Staple: "#a8a29e" };

const MOTION_CSS = `
@keyframes inv-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes inv-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes inv-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.inv-rise { animation: inv-rise .45s cubic-bezier(.2,.9,.3,1.1) both; }
.inv-grow { transform-box: fill-box; transform-origin: bottom; animation: inv-grow .7s cubic-bezier(.2,.8,.2,1) both; }
.inv-fill { transform-origin: left; animation: inv-fill .9s cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .inv-rise, .inv-grow, .inv-fill { animation: none; } }
`;

export default function InventoryScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("inventory");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const user = await restoreSession();
      if (!live) return;
      if (!user) return setState({ status: "signed-out" });
      try {
        const r = await fetch("/api/me/diet");
        const body = await r.json();
        if (!live) return;
        if (r.status === 401) return setState({ status: "signed-out" });
        if (!r.ok) throw new Error(body.error ?? "Couldn't load your records.");
        setState({ status: "ready", data: body as Data });
      } catch (e) {
        if (live) setState({ status: "error", message: navigator.onLine ? (e as Error).message : "You're offline. Connect and try again." });
      }
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  return (
    <section className="flex flex-col gap-5">
      <style>{MOTION_CSS}</style>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Inventory</h1>
          <p className="text-muted">Every protein you&apos;ve eaten, every meal you&apos;ve logged.</p>
        </div>
        {state.status === "ready" && (
          <span className="shrink-0 rounded-2xl bg-ink-soft px-3 py-2 text-center text-on-ink">
            <span className="block text-2xl font-black tabular-nums leading-none">{state.data.diet.inventory.filter((s) => s.mealCount > 0).length}</span>
            <span className="text-xs font-bold text-on-ink-muted">of {state.data.diet.inventory.length} found</span>
          </span>
        )}
      </header>

      {state.status === "loading" && (
        <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your inventory">
          {[0, 1, 2].map((i) => <li key={i} className="h-28 animate-pulse rounded-3xl bg-stone-200" />)}
        </ul>
      )}
      {state.status === "signed-out" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper p-6 text-center shadow-sm">
          <p className="font-bold">Pick a nickname on Home first, then your meals show up here.</p>
          <Link href="/home" className="min-h-12 rounded-full bg-leaf px-6 py-3 font-black text-white">Go to Home</Link>
        </div>
      )}
      {state.status === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper p-6 text-center shadow-sm">
          <p className="font-bold">{state.message}</p>
          <button onClick={() => { setState({ status: "loading" }); setReload((n) => n + 1); }} className="min-h-12 rounded-full bg-leaf px-6 font-black text-white">
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <Tabs tab={tab} setTab={setTab} meals={state.data.meals.length} />
          <div key={tab} className="inv-rise">
            {tab === "inventory" && <InventoryTab diet={state.data.diet} />}
            {tab === "records" && <Records meals={state.data.meals} />}
            {tab === "diet" && <DietTab diet={state.data.diet} />}
          </div>
        </>
      )}
    </section>
  );
}

function Tabs({ tab, setTab, meals }: { tab: Tab; setTab: (t: Tab) => void; meals: number }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "inventory", label: "Inventory" },
    { id: "records", label: `Records${meals ? ` (${meals})` : ""}` },
    { id: "diet", label: "My diet" },
  ];
  const i = tabs.findIndex((t) => t.id === tab);
  return (
    <div role="tablist" aria-label="Inventory views" className="relative grid grid-cols-3 rounded-full bg-mist p-1">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-leaf shadow transition-transform duration-300 ease-out"
        style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${i * 100}%)` }}
      />
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}
          className={`relative min-h-12 rounded-full px-2 text-sm font-black transition-colors ${tab === t.id ? "text-white" : "text-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function InventoryTab({ diet }: { diet: Diet }) {
  const progress = diet.inventory.filter((s) => s.mealCount > 0).map((s) => ({ group: s.group, mealCount: s.mealCount }));
  const foods = Object.fromEntries(diet.inventory.map((s) => [s.group, s.foods]));
  return (
    <div className="flex flex-col gap-4">
      {progress.length === 0 && <EmptyScan text="Scan a meal and its proteins fill your first slots." />}
      <DexGrid progress={progress} foods={foods} />
    </div>
  );
}

const dayLabel = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 3600_000);
  const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
  const key = d.toISOString().slice(0, 10);
  const yest = new Date(Date.now() + 3600_000 - 86400_000).toISOString().slice(0, 10);
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

function Records({ meals }: { meals: DietMeal[] }) {
  if (!meals.length) return <EmptyScan text="No meals yet. Every scan you save lands here." />;
  const groups = new Map<string, DietMeal[]>();
  for (const m of meals) {
    const k = dayLabel(m.at);
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([day, ms]) => (
        <section key={day} aria-label={day} className="flex flex-col gap-2">
          <h2 className="flex items-baseline justify-between text-lg font-black">
            {day}
            <span className="text-sm font-bold text-muted">
              {ms.length} {ms.length === 1 ? "meal" : "meals"} · ~{Math.round(ms.reduce((s, m) => s + m.total, 0))} g protein
            </span>
          </h2>
          <ul className="flex flex-col gap-2">
            {ms.map((m) => (
              <li key={m.id} className="rounded-[1.5rem_1.5rem_1.5rem_0.5rem] bg-paper p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{m.dish ?? "Meal"}</p>
                    <p className="text-xs text-muted">{timeLabel(m.at)}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-xl font-black tabular-nums">{Math.round(m.total)} g</span>
                    <span className="text-xs text-muted">protein (est.)</span>
                  </p>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {m.items.map((it, i) => (
                    <li key={i} className="flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-xs font-bold">
                      <span className="size-2.5 rounded-full" style={{ background: TYPE_COLOR[it.type ?? "Staple"] }} aria-hidden />
                      {it.label}
                      <span className="font-semibold text-muted">{Math.round(it.grams)} g</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DietTab({ diet }: { diet: Diet }) {
  const { stats, insights, days } = diet;
  if (!stats.meals) return <EmptyScan text="Scan a few meals and we'll chart your diet and read it back to you." />;
  const tiles = [
    { label: "protein per meal", value: `${stats.avgProteinPerMeal} g` },
    { label: "from alt proteins", value: stats.plantSharePct == null ? "n/a" : `${stats.plantSharePct}%` },
    { label: "groups this week", value: String(stats.groupsThisWeek) },
    { label: "day streak", value: String(stats.streakDays) },
  ];
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="inv-rise rounded-2xl bg-ink-soft px-3 py-3 text-on-ink" style={{ animationDelay: `${i * 60}ms` }}>
            <dd className="text-2xl font-black tabular-nums text-palm">{t.value}</dd>
            <dt className="text-xs font-semibold text-on-ink-muted">{t.label}</dt>
          </div>
        ))}
      </dl>

      <DailyChart days={days} />
      <ShareBar shares={stats.shares} />

      <section aria-label="Analysis" className="flex flex-col gap-2">
        <h2 className="text-xl font-black">What your meals say</h2>
        <ul className="flex flex-col gap-2">
          {insights.map((ins, i) => <InsightRow key={ins.title} ins={ins} delay={i * 70} />)}
        </ul>
        <p className="text-xs text-muted">Protein figures are estimates from your scans, not medical advice.</p>
      </section>
    </div>
  );
}

function InsightRow({ ins, delay }: { ins: Insight; delay: number }) {
  const look = {
    good: { bg: "bg-leaf/10", icon: <CheckIcon size={18} />, chip: "bg-leaf text-white" },
    tip: { bg: "bg-palm/20", icon: <SparkIcon size={18} />, chip: "bg-pepper text-white" },
    info: { bg: "bg-mist", icon: <LeafIcon size={18} />, chip: "bg-ink-soft text-on-ink" },
  }[ins.tone];
  return (
    <li className={`inv-rise flex items-start gap-3 rounded-2xl p-3 ${look.bg}`} style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${look.chip}`} aria-hidden>{look.icon}</span>
      <span>
        <span className="block font-extrabold">{ins.title}</span>
        <span className="text-sm text-stone-700">{ins.body}</span>
      </span>
    </li>
  );
}

/** Stacked columns: protein by source per day, last 14 days. 2px surface gap between segments. */
function DailyChart({ days }: { days: DayBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, L = 34, B = 26, T = 10;
  const plotW = W - L - 6, plotH = H - B - T;
  const total = (d: DayBar) => d.plant + d.alternative + d.animal;
  const max = Math.max(10, ...days.map(total));
  const step = max > 80 ? 40 : max > 40 ? 20 : 10;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const slot = plotW / days.length;
  const bw = Math.min(24, slot * 0.62);
  const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", timeZone: "UTC" }).slice(0, 2);
  const h = hover == null ? null : days[hover];

  return (
    <section aria-label="Protein by day" className="rounded-3xl bg-paper p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black">Protein by day</h2>
        <ul className="flex flex-wrap gap-3 text-xs font-bold text-stone-700" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">Grams of protein from protein foods, last 14 days (estimate). Tap a day for numbers.</p>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stacked columns of daily protein by source">
          {Array.from({ length: top / step + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke="#e7e2d6" strokeWidth={1} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5c564e">{v}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = L + slot * i + slot / 2;
            let acc = 0;
            const segs = SERIES.map((s) => ({ ...s, v: d[s.key] })).filter((s) => s.v > 0);
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: "pointer" }}>
                <rect x={cx - slot / 2} y={T} width={slot} height={plotH} fill={hover === i ? "#f4eedc" : "transparent"} />
                {segs.map((s, k) => {
                  const y0 = y(acc), y1 = y(acc + s.v);
                  acc += s.v;
                  const isTop = k === segs.length - 1;
                  const hgt = Math.max(0, y0 - y1 - (k > 0 ? 2 : 0)); // 2px surface gap between segments
                  const r = isTop ? Math.min(4, hgt / 2, bw / 2) : 0;
                  return (
                    <path
                      key={s.key}
                      className="inv-grow"
                      style={{ animationDelay: `${i * 35}ms` }}
                      fill={s.color}
                      d={`M${cx - bw / 2},${y1 + hgt} V${y1 + r} Q${cx - bw / 2},${y1} ${cx - bw / 2 + r},${y1} H${cx + bw / 2 - r} Q${cx + bw / 2},${y1} ${cx + bw / 2},${y1 + r} V${y1 + hgt} Z`}
                    />
                  );
                })}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={i === days.length - 1 ? "#1c1917" : "#5c564e"} fontWeight={i === days.length - 1 ? 800 : 500}>
                  {i === days.length - 1 ? "Today" : short(d.date)}
                </text>
              </g>
            );
          })}
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-44 rounded-2xl bg-ink-soft p-3 text-xs text-on-ink shadow-lg"
            style={{ left: `clamp(0px, calc(${((L + slot * (hover! + 0.5)) / W) * 100}% - 5.5rem), calc(100% - 11rem))` }}
          >
            <p className="font-black">{new Date(`${h.date}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                <span className="font-bold tabular-nums">{h[s.key]} g</span>
              </p>
            ))}
            <p className="mt-1 text-on-ink-muted">{h.meals} {h.meals === 1 ? "meal" : "meals"} · staples {h.staple} g</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Where all your protein came from, one stacked bar with values in the legend. */
function ShareBar({ shares }: { shares: { plant: number; alternative: number; animal: number; staple: number } }) {
  const parts = [...SERIES.map((s) => ({ label: s.label, color: s.color, v: shares[s.key] })), { label: "Staples", color: "#a8a29e", v: shares.staple }].filter((p) => p.v > 0);
  const sum = parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <section aria-label="Where your protein comes from" className="rounded-3xl bg-paper p-4 shadow-sm">
      <h2 className="text-lg font-black">Where your protein comes from</h2>
      <div className="mt-3 flex h-6 gap-0.5 overflow-hidden rounded-lg" aria-hidden>
        {parts.map((p, i) => (
          <span key={p.label} className="inv-fill h-full first:rounded-l-lg last:rounded-r-lg" style={{ width: `${(p.v / sum) * 100}%`, background: p.color, animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold text-stone-700"><span className="size-3 rounded-sm" style={{ background: p.color }} aria-hidden />{p.label}</span>
            <span className="tabular-nums text-stone-700">{Math.round((p.v / sum) * 100)}% · {Math.round(p.v)} g</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyScan({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper p-6 text-center shadow-sm">
      <p className="font-bold">{text}</p>
      <Link href="/scan" className="flex min-h-12 items-center gap-2 rounded-full bg-leaf px-6 font-black text-white">
        <ScanIcon size={20} /> Scan a meal
      </Link>
    </div>
  );
}
