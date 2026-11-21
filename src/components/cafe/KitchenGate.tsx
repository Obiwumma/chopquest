"use client";
// Kitchen sign-in gate: every /kitchen/<cafeteria> page sits behind that cafeteria's 6-digit code.
// The code is asked once per device (httpOnly cookie, 30 days). Students never see these screens.

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Cafeteria } from "@/lib/types";
import { saveKitchen, useDemoCodes } from "@/lib/cafe-client";
import { ChefIcon } from "@/components/icons";
import { SkeletonRows } from "./bits";

type Gate = { status: "checking" } | { status: "out" } | { status: "in"; cafeteria: Cafeteria };

export default function KitchenGate({ slug, children }: { slug: string; children: ReactNode }) {
  const [gate, setGate] = useState<Gate>({ status: "checking" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = useDemoCodes()[slug];

  useEffect(() => {
    let live = true;
    fetch("/api/kitchen/session")
      .then(async (r) => (r.ok ? ((await r.json()) as { cafeteria: Cafeteria }) : null))
      .then((d) => live && setGate(d ? { status: "in", cafeteria: d.cafeteria } : { status: "out" }))
      .catch(() => live && setGate({ status: "out" }));
    return () => {
      live = false;
    };
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/kitchen/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Couldn't sign in. Try again.");
      saveKitchen(slug);
      setCode("");
      setGate({ status: "in", cafeteria: d.cafeteria });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/kitchen/session", { method: "DELETE" }).catch(() => {});
    setGate({ status: "out" });
  }

  if (gate.status === "checking") return <SkeletonRows n={3} label="Checking kitchen sign-in" />;

  if (gate.status === "in" && gate.cafeteria.slug === slug)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-green-50 px-4 py-2 text-sm">
          <span className="font-bold text-green-900">
            Kitchen: {gate.cafeteria.name} <span className="font-normal text-green-800">(signed in)</span>
          </span>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full px-3 font-bold text-green-800 underline-offset-4 hover:underline">
            Sign out
          </button>
        </div>
        {children}
      </div>
    );

  if (gate.status === "in")
    return (
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-green-950">You&apos;re signed in to {gate.cafeteria.name}</h1>
        <p className="text-stone-700">Each kitchen only sees its own dishes and costs. Sign out to use another cafeteria&apos;s code.</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/kitchen/${gate.cafeteria.slug}`} className="flex min-h-12 items-center rounded-full bg-leaf px-5 font-bold text-white">
            Go to {gate.cafeteria.name}
          </Link>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full px-5 font-bold text-green-800 ring-2 ring-green-200">
            Sign out
          </button>
        </div>
      </div>
    );

  return (
    <form onSubmit={signIn} className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-[1.6rem_0.5rem] bg-leaf text-white">
        <ChefIcon size={28} />
      </span>
      <div>
        <h1 className="text-2xl font-black text-green-950">Kitchen sign-in</h1>
        <p className="mt-1 text-stone-700">Enter your cafeteria&apos;s 6-digit kitchen code. You only need to do this once on this phone.</p>
      </div>
      {demo && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-palm/25 p-3">
          <span className="text-sm text-stone-800">
            <b className="block text-green-950">Demo access</b>
            Code for this kitchen: <b className="font-black tracking-widest">{demo}</b>
          </span>
          <button type="button" onClick={() => setCode(demo)} className="min-h-12 shrink-0 rounded-full bg-leaf px-4 font-black text-white">
            Fill it in
          </button>
        </div>
      )}
      <label className="flex flex-col gap-1 font-bold text-green-950">
        Kitchen code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          aria-describedby={error ? "kitchen-code-error" : undefined}
          className="min-h-14 rounded-2xl border-2 border-green-200 bg-white px-4 text-center text-2xl font-black tracking-[0.4em] text-green-950 focus:border-leaf"
        />
      </label>
      {error && (
        <p id="kitchen-code-error" role="alert" className="rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || code.length !== 6} className="min-h-12 rounded-full bg-leaf px-5 font-black text-white disabled:opacity-50">
        {busy ? "Checking..." : "Open my kitchen"}
      </button>
      <p className="text-sm text-stone-600">
        No code yet? Ask the ChopQuest team. <Link href="/kitchen" className="font-bold text-green-800 underline">Pick a different cafeteria</Link>
      </p>
    </form>
  );
}
