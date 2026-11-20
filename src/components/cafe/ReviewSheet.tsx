"use client";
// 5. Write a review: nickname (remembered), big stars, would order again, optional comment.

import { useEffect, useRef, useState } from "react";
import type { Review } from "@/lib/types";
import { deviceId, loadNickname, postJson, saveNickname } from "@/lib/cafe-client";
import { CloseIcon, StarIcon } from "@/components/icons";

const MAX = 280;
const STAR_WORDS = ["", "Not for me", "It's okay", "Good", "Really good", "Loved it"];

export default function ReviewSheet({ dishId, dishName, onClose, onSaved }: { dishId: number; dishName: string; onClose: () => void; onSaved: (r: Review) => void }) {
  const [nickname, setNickname] = useState(() => (typeof window === "undefined" ? "" : loadNickname()));
  const [stars, setStars] = useState(0);
  const [again, setAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Any edit clears the last error, so it never sits next to a field that's now fine.
  const edit = <T,>(fn: (v: T) => void) => (v: T) => {
    setError(null);
    fn(v);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nickname.trim().length < 2) return setError("Pick a nickname (2 to 20 characters).");
    if (!stars) return setError("Tap the stars to rate it.");
    if (again === null) return setError("Would you order it again? Pick yes or no.");
    setBusy(true);
    setError(null);
    try {
      const { review } = await postJson<{ review: Review }>(`/api/plant-dishes/${dishId}/reviews`, {
        nickname: nickname.trim(),
        stars,
        wouldOrderAgain: again,
        comment: comment.trim() || null,
        deviceId: deviceId(),
      });
      saveNickname(nickname.trim());
      onSaved(review);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="rv-title">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-green-950/40 backdrop-blur-[2px]" />
      <form
        onSubmit={submit}
        className="cf-rise relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-[2rem] bg-[#fbfdf6] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl md:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-leaf-dark">Your review</p>
            <h2 id="rv-title" className="text-2xl font-black leading-tight text-green-950">{dishName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-green-100">
            <CloseIcon size={22} />
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-extrabold text-green-950">Nickname</span>
          <input
            ref={first}
            value={nickname}
            maxLength={20}
            onChange={(e) => edit(setNickname)(e.target.value)}
            placeholder="e.g. JollofKing"
            className="min-h-12 rounded-xl border border-stone-200 bg-white px-3 text-base font-bold focus:border-leaf focus:outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="font-extrabold text-green-950">How was it?</legend>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={`${n}-${stars >= n}`}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => edit(setStars)(n)}
                className={`flex size-14 items-center justify-center rounded-2xl transition active:scale-90 ${stars >= n ? "cf-pop text-amber-400" : "text-stone-300 hover:text-amber-200"}`}
              >
                <StarIcon size={40} filled={stars >= n} />
              </button>
            ))}
          </div>
          <p className="h-5 text-sm font-bold text-amber-800" aria-live="polite">{STAR_WORDS[stars]}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-extrabold text-green-950">Would you order it again?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={again === v}
                onClick={() => edit(setAgain)(v)}
                className={`min-h-12 rounded-full text-lg font-black transition ${again === v ? (v ? "bg-leaf text-white" : "bg-stone-700 text-white") : "bg-white text-green-950 ring-1 ring-stone-200"}`}
              >
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between font-extrabold text-green-950">
            Comment <span className="font-bold text-stone-500">optional</span>
          </span>
          <textarea
            value={comment}
            maxLength={MAX}
            rows={3}
            onChange={(e) => edit(setComment)(e.target.value)}
            placeholder="What did you think? Taste, portion, would you tell a friend?"
            className="rounded-xl border border-stone-200 bg-white p-3 text-base focus:border-leaf focus:outline-none"
          />
          <span className={`self-end text-xs ${comment.length > MAX - 20 ? "font-bold text-amber-800" : "text-stone-500"}`}>
            {comment.length}/{MAX}
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-14 rounded-full bg-pepper text-lg font-black text-white shadow-md hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60">
          {busy ? "Posting..." : "Post review"}
        </button>
      </form>
    </div>
  );
}
