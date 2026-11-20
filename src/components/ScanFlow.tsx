"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadUser, type User } from "@/lib/user";
import { resizeToJpeg } from "@/lib/image";
import type { DraftItem, Food, ScanResponse } from "@/lib/foods";
import { Button } from "@/components/ui";
import ScanReticle from "@/components/ScanReticle";
import { ArrowLeftIcon, CameraIcon, CheckIcon, CloseIcon, ImageIcon, ScanIcon } from "@/components/icons";

type Row = {
  key: string;
  raw_label: string | null; // what the AI said (null for foods the user added)
  portion: string;
  estimated_grams: number;
  confidence: number | null;
  matched_food_id: number | null;
  food_id: number | null;
  added: boolean;
};

type Stage =
  | { name: "pick" }
  | { name: "analyzing"; preview: string }
  | { name: "confirm"; preview: string; dish: string; cached: boolean }
  | { name: "saving"; preview: string; dish: string }
  | { name: "saved"; scanId: number; total: number; dish: string };

const TYPE_LABEL: Record<Food["type"], string> = {
  Animal: "Animal protein",
  Plant: "Plant protein",
  Alternative: "Alternative protein",
  Staple: "Staples",
};
const TYPE_ORDER: Food["type"][] = ["Plant", "Alternative", "Animal", "Staple"];

const foodLabel = (f: Food) =>
  f.local_name && f.local_name.toLowerCase() !== f.food.toLowerCase() ? `${f.local_name} · ${f.food}` : f.food;

let nextKey = 0;
const toRow = (d: DraftItem): Row => ({
  key: `r${nextKey++}`,
  raw_label: d.food,
  portion: d.portion,
  estimated_grams: d.estimated_grams,
  confidence: d.confidence,
  matched_food_id: d.matched_food_id,
  food_id: d.matched_food_id,
  added: false,
});

export default function ScanFlow() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [rows, setRows] = useState<Row[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = loadUser();
    if (!u) {
      router.replace("/");
      return;
    }
    setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage is browser-only
    fetch("/api/foods")
      .then((r) => r.json())
      .then((d) => setFoods(d.foods ?? []))
      .catch(() => {});
  }, [router]);

  const foodsById = new Map(foods.map((f) => [f.id, f]));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same photo again
    if (!file) return;
    setError(null);
    let dataUrl: string;
    try {
      dataUrl = await resizeToJpeg(file);
    } catch {
      setError("Couldn't open that photo. Try another one.");
      return;
    }
    setStage({ name: "analyzing", preview: dataUrl });
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl.split(",")[1] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The scanner had a problem. Try again.");
        setStage({ name: "pick" });
        return;
      }
      const scan = data as ScanResponse;
      setRows(scan.items.map(toRow));
      setStage({ name: "confirm", preview: dataUrl, dish: scan.dish_name, cached: scan.cached });
    } catch {
      setError("No connection. Check your network and try again.");
      setStage({ name: "pick" });
    }
  }

  function setFood(key: string, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, food_id: value ? Number(value) : null } : r)));
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function addRow(value: string) {
    if (!value) return;
    setRows((rs) => [
      ...rs,
      {
        key: `r${nextKey++}`,
        raw_label: null,
        portion: "1 serving",
        estimated_grams: 100,
        confidence: null,
        matched_food_id: null,
        food_id: Number(value),
        added: true,
      },
    ]);
  }

  async function save() {
    if (stage.name !== "confirm" || !user) return;
    if (!rows.length) {
      setError("Add at least one food.");
      return;
    }
    setError(null);
    setStage({ name: "saving", preview: stage.preview, dish: stage.dish });
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          dish_name: stage.dish,
          items: rows.map((r) => ({
            raw_label: r.raw_label,
            food_id: r.food_id,
            estimated_grams: r.estimated_grams,
            corrected: r.added || r.food_id !== r.matched_food_id,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your meal. Try again.");
        setStage({ name: "confirm", preview: stage.preview, dish: stage.dish, cached: false });
        return;
      }
      setStage({ name: "saved", scanId: data.scan_id, total: data.total_protein_g, dish: stage.dish });
    } catch {
      setError("No connection. Your list is still here, so try again.");
      setStage({ name: "confirm", preview: stage.preview, dish: stage.dish, cached: false });
    }
  }

  function reset() {
    setRows([]);
    setError(null);
    setStage({ name: "pick" });
  }

  const foodOptions = (
    <>
      {TYPE_ORDER.map((t) => (
        <optgroup key={t} label={TYPE_LABEL[t]}>
          {foods
            .filter((f) => f.type === t)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {foodLabel(f)}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );

  if (!user) return null;

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="-ml-2 flex min-h-12 items-center px-2 text-lg font-bold text-muted" aria-label="Back home">
          <ArrowLeftIcon size={20} className="mr-1" /> Home
        </Link>
        <span className="text-sm font-semibold text-muted">{user.nickname}</span>
      </header>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} data-testid="camera-input" />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="gallery-input" />

      {error && (
        <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 font-semibold text-danger motion-safe:animate-rise">
          {error}
        </p>
      )}

      {stage.name === "pick" && (
        <div className="flex flex-1 flex-col justify-center gap-4 text-center">
          <ScanReticle />
          <h1 className="text-3xl font-black motion-safe:animate-rise">What are you eating?</h1>
          <p className="text-muted motion-safe:animate-rise [animation-delay:80ms]">Snap your plate from above, in good light.</p>
          <Button size="lg" onClick={() => cameraRef.current?.click()} className="mt-2" icon={<CameraIcon />}>
            Take a photo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => galleryRef.current?.click()} icon={<ImageIcon />}>
            Choose from gallery
          </Button>
          <p className="text-xs text-muted">Your photo is only used to spot the food. We don&apos;t keep it.</p>
        </div>
      )}

      {stage.name === "analyzing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <ScanReticle preview={stage.preview} />
          <p className="flex items-center gap-2 text-xl font-black" role="status">
            Reading your plate
            <span className="flex gap-1" aria-hidden>
              <span className="size-2 rounded-full bg-leaf-dark motion-safe:animate-blink" />
              <span className="size-2 rounded-full bg-leaf-dark motion-safe:animate-blink [animation-delay:200ms]" />
              <span className="size-2 rounded-full bg-leaf-dark motion-safe:animate-blink [animation-delay:400ms]" />
            </span>
          </p>
        </div>
      )}

      {(stage.name === "confirm" || stage.name === "saving") && (
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={stage.preview} alt="Your meal" className="max-h-48 w-full rounded-3xl object-cover shadow" />
          <div>
            <h1 className="text-2xl font-extrabold">{stage.dish}</h1>
            <p className="text-muted">Is this right? Tap a food to fix it.</p>
          </div>

          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const unsure = r.confidence !== null && r.confidence < 0.6;
              const changed = r.added || r.food_id !== r.matched_food_id;
              return (
                <li
                  key={r.key}
                  className={`rounded-2xl border-2 bg-paper p-3 motion-safe:animate-rise ${
                    r.food_id === null || unsure ? "border-palm" : "border-line/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.raw_label ?? foodsById.get(r.food_id ?? -1)?.food ?? "Added food"}</p>
                      <p className="text-sm text-muted">
                        {r.portion} · ~{r.estimated_grams} g
                        {unsure && <span className="ml-2 font-semibold text-warn-ink">not sure, check it</span>}
                        {changed && !r.added && <span className="ml-2 inline-flex items-center gap-0.5 font-semibold text-leaf-dark"><CheckIcon size={14} /> fixed</span>}
                        {r.added && <span className="ml-2 inline-flex items-center gap-0.5 font-semibold text-leaf-dark"><CheckIcon size={14} /> added</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => removeRow(r.key)}
                      aria-label={`Remove ${r.raw_label ?? "food"}`}
                      className="-mr-1 -mt-1 grid size-12 shrink-0 place-items-center rounded-full text-muted transition-transform active:bg-mist motion-safe:active:scale-90"
                    >
                      <CloseIcon size={20} />
                    </button>
                  </div>
                  <select
                    value={r.food_id ?? ""}
                    onChange={(e) => setFood(r.key, e.target.value)}
                    aria-label={`Food for ${r.raw_label ?? "added item"}`}
                    className="mt-2 min-h-12 w-full rounded-xl border-2 border-line bg-mist px-3 text-base font-semibold"
                  >
                    <option value="">Not sure? Pick a food</option>
                    {foodOptions}
                  </select>
                </li>
              );
            })}
          </ul>

          <select
            value=""
            onChange={(e) => addRow(e.target.value)}
            aria-label="Add a food we missed"
            className="min-h-14 w-full rounded-2xl border-2 border-dashed border-line bg-transparent px-4 text-base font-bold text-muted"
          >
            <option value="">Add a food we missed</option>
            {foodOptions}
          </select>

          <p className="text-xs text-muted">Portions and protein are estimates, not medical advice.</p>

          {/* Sticks just above the bottom nav. */}
          <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] -mx-4 flex gap-3 bg-cream/95 px-4 pb-3 pt-2 backdrop-blur">
            <Button variant="secondary" size="lg" onClick={reset} disabled={stage.name === "saving"} className="text-lg">
              Retake
            </Button>
            <Button size="lg" onClick={save} disabled={stage.name === "saving" || rows.length === 0} className="flex-1 text-lg">
              {stage.name === "saving" ? "Saving…" : "Looks good"}
            </Button>
          </div>
        </div>
      )}

      {stage.name === "saved" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <svg viewBox="0 0 100 100" className="size-28 motion-safe:animate-pop" aria-hidden>
            <circle cx="50" cy="50" r="44" style={{ fill: "var(--color-leaf-dark)" }} />
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" style={{ stroke: "var(--color-leaf-deep)" }} />
            <path
              d="M30 51 44 65 71 37"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60"
              className="motion-safe:animate-draw"
              style={{ stroke: "var(--color-on-ink)" }}
            />
          </svg>
          <h1 className="text-2xl font-black motion-safe:animate-rise">{stage.dish} saved</h1>
          <p className="text-lg motion-safe:animate-rise [animation-delay:100ms]">
            About <span className="text-3xl font-black tabular-nums text-leaf-dark">{stage.total} g</span> of protein
            <span className="block text-sm text-muted">(estimate)</span>
          </p>
          <p className="text-muted">Your Protein Map is coming in the next update.</p>
          <Button size="lg" block onClick={reset} icon={<ScanIcon />}>
            Scan another meal
          </Button>
          <Button href="/" variant="ghost">
            Back home
          </Button>
        </div>
      )}
    </section>
  );
}
