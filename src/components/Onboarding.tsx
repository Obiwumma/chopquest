"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import PetEgg from "@/components/PetEgg";
import HomeScreen from "@/components/home/HomeScreen";
import {
  clean,
  validate,
  loadUser,
  saveUser,
  clearUser,
  NICKNAME_MAX,
  GROUP_MAX,
  type User,
} from "@/lib/user";

type Status = "loading" | "form" | "ready";

export default function Onboarding() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Restore a saved user. If the server says it no longer exists (DB reset), start over.
  // Network/server errors keep the saved user so the app still works offline.
  useEffect(() => {
    // localStorage only exists in the browser, so this must run after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadUser();
    if (!saved) {
      setStatus("form");
      return;
    }
    setUser(saved);
    setStatus("ready");
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/users/${saved.id}`)
      .then((r) => {
        if (r.status === 404) {
          clearUser();
          setUser(null);
          setStatus("form");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "form") return;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {});
  }, [status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = clean(nickname);
    const g = clean(group);
    const invalid = validate(n, g);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: n, group: g }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      saveUser(data.user);
      setUser(data.user);
      setStatus("ready");
    } catch {
      setError("No connection. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchUser() {
    clearUser();
    setUser(null);
    setNickname("");
    setGroup("");
    setStatus("form");
  }

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
        <PetEgg size={96} />
      </div>
    );
  }

  if (status === "ready" && user) {
    return <HomeScreen user={user} onSwitchUser={switchUser} />;
  }

  return (
    <section className="flex flex-1 flex-col justify-center gap-8">
      <header className="flex flex-col items-center text-center">
        <PetEgg size={88} />
        <h1 className="mt-3 text-4xl font-black tracking-tight text-leaf-deep motion-safe:animate-rise">ChopQuest</h1>
        <p className="mt-1 text-lg font-bold text-pepper-ink motion-safe:animate-rise [animation-delay:100ms]">
          Keep your jollof, upgrade your protein.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <label className="flex flex-col gap-2">
          <span className="text-lg font-bold">Pick a nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            placeholder="e.g. JollofKing"
            className="min-h-14 rounded-2xl border-2 border-line bg-paper px-4 text-lg transition-colors focus:border-leaf-dark"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-lg font-bold">Your group</span>
          <span className="-mt-1 text-sm text-muted">Hall, department or squad. You&apos;ll compete on the leaderboard.</span>
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            maxLength={GROUP_MAX}
            list="group-options"
            placeholder="e.g. Hall B, Microbiology"
            className="min-h-14 rounded-2xl border-2 border-line bg-paper px-4 text-lg transition-colors focus:border-leaf-dark"
          />
          <datalist id="group-options">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Existing groups">
            {groups.slice(0, 6).map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => setGroup(g)}
                className={`min-h-12 rounded-full border-2 px-4 py-2 text-sm font-bold transition-[transform,background-color,color] duration-150 motion-safe:active:scale-95 ${
                  clean(group).toLowerCase() === g.toLowerCase()
                    ? "border-leaf-dark bg-leaf-dark text-on-ink"
                    : "border-line bg-paper text-ink"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 font-semibold text-danger motion-safe:animate-rise">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Hatching…" : "Start my quest"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted">No password needed. Nutrition figures are estimates, not medical advice.</p>
    </section>
  );
}
