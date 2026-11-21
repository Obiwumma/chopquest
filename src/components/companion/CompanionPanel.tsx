"use client";
// The companion panel: how your bean is doing (grows with what you eat) and a chat you can
// type or speak into; it answers out loud and points you to real plant dishes on campus.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Pet from "@/components/pet/Pet";
import { CloseIcon, ScanIcon, StarIcon } from "@/components/icons";
import { naira } from "@/lib/cafe-client";
import type { CampusDish } from "@/lib/companion-reply";
import { savePetName, type CompanionState } from "./useCompanion";
import { canSpeak, makeRecognizer, speak, stopSpeaking } from "./voice";

type Msg = { role: "user" | "pet"; text: string; dishes?: CampusDish[] };

const STAGE_LABEL = { egg: "Egg", young: "Sprout", evolved: "Fully grown" } as const;
const MOOD_LINE = {
  happy: "is buzzing! Lots of protein variety this week.",
  content: "is doing fine. One more protein group makes it happy.",
  sleepy: "is sleepy. A meal with beans, soy or egg will wake it up.",
} as const;
const STARTERS = ["What should I eat today?", "What am I missing this week?", "Find me a cheap plant dish"];
const VOICE_KEY = "chopquest_voice";

export default function CompanionPanel({
  state,
  name,
  onRename,
  onClose,
  onRefresh,
}: {
  state: CompanionState;
  name: string;
  onRename: (n: string) => void;
  onClose: () => void;
  onRefresh: () => unknown;
}) {
  const [tab, setTab] = useState<"me" | "talk">("me");
  const closeRef = useRef<HTMLButtonElement>(null);
  const handlers = useRef({ onClose, onRefresh });
  useEffect(() => {
    handlers.current = { onClose, onRefresh };
  });

  // Once on open: refresh the companion, focus Close, listen for Escape, stop speech on close.
  useEffect(() => {
    void handlers.current.onRefresh();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handlers.current.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stopSpeaking();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end md:items-stretch" role="dialog" aria-modal="true" aria-label={`${name}, your companion`}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-green-950/40 backdrop-blur-[2px]" />
      <div className="cf-rise relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-[#f6fbef] shadow-2xl md:h-full md:max-w-md md:rounded-none md:rounded-l-[2rem]">
        <style>{`@keyframes cf-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } } .cf-rise { animation: cf-rise .35s cubic-bezier(.2,.9,.3,1.1) both; } @media (prefers-reduced-motion: reduce) { .cf-rise { animation: none; } }`}</style>
        <header className="flex items-center gap-2 px-4 pt-4">
          <div className="flex flex-1 rounded-full bg-white p-1 shadow-sm" role="tablist">
            {(["me", "talk"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-11 flex-1 rounded-full font-black transition ${tab === t ? "bg-leaf text-white" : "text-green-900 hover:bg-green-50"}`}
              >
                {t === "me" ? name : `Talk to ${name}`}
              </button>
            ))}
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-green-100">
            <CloseIcon size={22} />
          </button>
        </header>
        {tab === "me" ? <MeTab state={state} name={name} onRename={onRename} onTalk={() => setTab("talk")} /> : <TalkTab state={state} name={name} />}
      </div>
    </div>
  );
}

function MeTab({ state, name, onRename, onTalk }: { state: CompanionState; name: string; onRename: (n: string) => void; onTalk: () => void }) {
  const [editing, setEditing] = useState(false);

  if (state.status === "loading") return <div className="m-4 h-64 animate-pulse rounded-3xl bg-green-100" aria-busy="true" />;
  if (state.status === "no-user")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Pet stage="egg" mood="content" size={180} />
        <p className="text-2xl font-black text-green-950">Sign up to hatch your companion</p>
        <p className="text-stone-600">It grows with every alt protein you eat, and helps you find plant dishes on campus.</p>
        <Link href="/home" className="flex min-h-12 items-center rounded-full bg-leaf px-6 font-black text-white">Sign up</Link>
      </div>
    );
  if (state.status === "error") return <p className="m-4 rounded-2xl bg-red-50 p-4 font-bold text-red-800">{state.message}</p>;

  const c = state.c;
  const from = c.stage === "young" ? 100 : c.stage === "evolved" ? 400 : 0;
  const pct = c.nextStageAt ? Math.min(100, ((c.points - from) / (c.nextStageAt - from)) * 100) : 100;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8">
      <section className="flex flex-col items-center rounded-[2rem] bg-gradient-to-b from-[#dcfce7] to-white p-4 text-center">
        <Pet stage={c.stage} mood={c.mood} size={190} />
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = (new FormData(e.currentTarget).get("n") as string).trim().slice(0, 16) || "Ewa";
              savePetName(v);
              onRename(v);
              setEditing(false);
            }}
            className="flex gap-2"
          >
            <input name="n" defaultValue={name} autoFocus maxLength={16} aria-label="Companion name" className="min-h-12 w-40 rounded-xl border border-stone-200 px-3 text-center text-lg font-black" />
            <button className="min-h-12 rounded-xl bg-leaf px-4 font-black text-white">Save</button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="min-h-12 rounded-full px-3 text-2xl font-black text-green-950 hover:bg-white/70" aria-label={`Rename ${name}`}>
            {name}
          </button>
        )}
        <p className="text-stone-700">
          <b>{name}</b> {MOOD_LINE[c.mood]}
        </p>
        <div className="mt-3 w-full">
          <div className="flex justify-between text-xs font-black text-stone-500">
            <span>{STAGE_LABEL[c.stage]}</span>
            <span>{c.nextStageAt ? `${c.nextStageAt - c.points} pts to grow` : "Fully grown"}</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-gradient-to-r from-palm to-leaf transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Points" value={String(c.points)} />
        <Stat label="This week" value={`${c.weeklyDiversity}`} sub="groups" />
        <Stat label="Strength" value={`${c.strength}%`} />
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="font-black text-green-950">Hungry for</h3>
        <p className="text-sm text-stone-600">Alt proteins {name} hasn&apos;t had this week</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.missingThisWeek.slice(0, 5).map((g) => (
            <span key={g} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{g}</span>
          ))}
          {c.thisWeek.map((g) => (
            <span key={g} className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-900 line-through decoration-2">{g}</span>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="font-black text-green-950">Powers unlocked</h3>
        {c.stats.length === 0 ? (
          <p className="text-sm text-stone-600">Each new protein you eat unlocks a power. Beans give Strength, soy gives Defense.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {c.stats.map((s) => (
              <li key={s.group} className="rounded-2xl bg-[#f3fbe9] p-2">
                <p className="text-sm font-black text-green-950">{s.trait ?? "Base stats"}</p>
                <p className="text-xs text-stone-600">
                  {s.group} · {s.meals} {s.meals === 1 ? "meal" : "meals"}
                  {s.medal && <b className="text-amber-700"> · {s.medal}</b>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/scan" className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-pepper font-black text-white">
          <ScanIcon size={22} /> Feed me
        </Link>
        <button onClick={onTalk} className="min-h-14 rounded-full bg-leaf font-black text-white">Talk to {name}</button>
      </div>
      <p className="text-center text-xs text-stone-500">Grows with variety, never with how much you eat. Not medical advice.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-2 shadow-sm">
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="text-2xl font-black tabular-nums text-green-950">
        {value}
        {sub && <span className="ml-0.5 text-xs font-bold text-stone-500">{sub}</span>}
      </p>
    </div>
  );
}

function TalkTab({ state, name }: { state: CompanionState; name: string }) {
  const user = state.status === "ready" ? state.user : null;
  const c = state.status === "ready" ? state.c : null;
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { role: "pet", text: user ? `Hi ${user.nickname}! I'm ${name}. Ask me what to eat, or what I'm missing this week.` : `Hi! I'm ${name}. Sign up so I can grow with you.` },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(false);
  const [micOk] = useState(() => makeRecognizer() !== null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  function say(t: string) {
    if (!voice || !canSpeak()) return;
    setTalking(true);
    speak(t, () => setTalking(false));
  }

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy || !user) return;
    const next: Msg[] = [...msgs, { role: "user", text: question }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, petName: name, messages: next.map(({ role, text }) => ({ role, text })) }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "I couldn't hear you properly. Try again.");
      setMsgs((m) => [...m, { role: "pet", text: body.reply, dishes: body.dishes }]);
      say(body.reply);
    } catch (e) {
      const t = navigator.onLine ? (e as Error).message : "We're offline, so I can't check campus dishes right now. Try again when you're connected.";
      setMsgs((m) => [...m, { role: "pet", text: t }]);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const r = makeRecognizer();
    if (!r) return;
    stopSpeaking();
    setListening(true);
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      setListening(false);
      void send(said);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
  }

  function toggleVoice() {
    const v = !voice;
    setVoice(v);
    if (!v) stopSpeaking();
    try {
      localStorage.setItem(VOICE_KEY, v ? "on" : "off");
    } catch {}
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={talking ? "cq-talk" : ""}>
          <Pet stage={c?.stage ?? "egg"} mood={c?.mood ?? "content"} size={64} />
        </span>
        <div className="flex-1">
          <p className="font-black text-green-950">{name}</p>
          <p className="text-xs font-bold text-stone-500">{busy ? "thinking..." : talking ? "talking..." : listening ? "listening..." : "here for you"}</p>
        </div>
        {canSpeak() && (
          <button onClick={toggleVoice} aria-pressed={voice} className={`min-h-11 rounded-full px-3 text-sm font-black ${voice ? "bg-leaf text-white" : "bg-stone-200 text-stone-700"}`}>
            Voice {voice ? "on" : "off"}
          </button>
        )}
      </div>
      <style>{`@keyframes cq-talk { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06) rotate(-2deg); } } .cq-talk { display: inline-block; animation: cq-talk .45s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .cq-talk { animation: none; } }`}</style>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`cf-rise flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <p className={`max-w-[85%] rounded-3xl px-4 py-2.5 ${m.role === "user" ? "rounded-br-md bg-leaf text-white" : "rounded-bl-md bg-white text-green-950 shadow-sm"}`}>{m.text}</p>
            {m.dishes?.map((d) => (
              <Link key={d.id} href={`/dishes/${d.id}`} className="flex w-[85%] items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-green-900/10 hover:bg-green-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-green-950">{d.name}</span>
                  <span className="block text-xs text-stone-600">
                    {d.cafeteria} · {naira(d.priceNgn)}
                  </span>
                </span>
                {d.avgRating != null && (
                  <span className="flex items-center gap-0.5 text-sm font-black text-amber-700">
                    <StarIcon size={14} filled className="text-amber-400" /> {d.avgRating.toFixed(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
        {busy && <p className="w-fit animate-pulse rounded-3xl rounded-bl-md bg-white px-4 py-2.5 text-stone-500 shadow-sm">...</p>}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && user && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {STARTERS.map((s) => (
            <button key={s} onClick={() => send(s)} className="min-h-11 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-green-900 shadow-sm ring-1 ring-green-900/10">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-center gap-2 border-t border-green-900/10 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        {micOk && (
          <button
            type="button"
            onClick={listen}
            disabled={!user || busy}
            aria-label={listening ? "Listening" : "Speak"}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full transition ${listening ? "animate-pulse bg-pepper text-white" : "bg-green-100 text-green-900"}`}
          >
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!user}
          placeholder={user ? `Ask ${name}...` : "Sign up first"}
          aria-label={`Message ${name}`}
          maxLength={400}
          className="min-h-12 min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 text-base focus:border-leaf focus:outline-none"
        />
        <button type="submit" disabled={!user || busy || !text.trim()} className="min-h-12 shrink-0 rounded-full bg-leaf px-5 font-black text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
