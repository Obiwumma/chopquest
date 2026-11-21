"use client";
// Browser helpers for the cafeteria screens: loading data with four states, ₦, time ago,
// and the reviewer's nickname / device id kept in localStorage.

import { useCallback, useEffect, useState } from "react";

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; message: string; code?: string }
  | { status: "ready"; data: T };

/** GET a JSON API. `url = null` waits. `retry()` loads again. */
export function useApi<T>(url: string | null): { state: Load<T>; retry: () => void; setData: (fn: (d: T) => T) => void } {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(body.error ?? "Something went wrong."), { code: body.code });
        setState({ status: "ready", data: body as T });
      })
      .catch((e: Error & { code?: string }) => {
        if (e.name === "AbortError") return;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setState({ status: "error", message: offline ? "You're offline. Connect and try again." : e.message, code: e.code });
      });
    return () => ctrl.abort();
  }, [url, nonce]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  }, []);
  const setData = useCallback((fn: (d: T) => T) => setState((s) => (s.status === "ready" ? { status: "ready", data: fn(s.data) } : s)), []);
  return { state, retry, setData };
}

/** POST JSON; throws an Error with the API's plain-words message. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error(typeof navigator !== "undefined" && !navigator.onLine ? "You're offline. Connect and try again." : "Couldn't reach the server. Try again.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error ?? "Something went wrong. Try again."), { code: data.code, status: r.status });
  return data as T;
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "min"], [3600, "hour"], [86400, "day"], [604800, "week"]];
  let out = "";
  for (const [secs, name] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      out = `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return out;
}

const NICK_KEY = "chopquest_reviewer";
const DEVICE_KEY = "chopquest_device";

export function loadNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveNickname(n: string) {
  try {
    localStorage.setItem(NICK_KEY, n);
  } catch {}
}
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

const KITCHEN_KEY = "chopquest_kitchen";
export function loadKitchen(): string | null {
  try {
    return localStorage.getItem(KITCHEN_KEY);
  } catch {
    return null;
  }
}
export function saveKitchen(slug: string) {
  try {
    localStorage.setItem(KITCHEN_KEY, slug);
  } catch {}
}

const ASKED_KEY = "chopquest_asked";
/** Menu items this browser already asked a plant version of. */
export function loadAsked(): number[] {
  try {
    return JSON.parse(localStorage.getItem(ASKED_KEY) ?? "[]") as number[];
  } catch {
    return [];
  }
}
export function saveAsked(ids: number[]) {
  try {
    localStorage.setItem(ASKED_KEY, JSON.stringify(ids));
  } catch {}
}

/** Kitchen codes shown publicly for the demo (only while the server's demo switch is on). */
export function useDemoCodes(): Record<string, string> {
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    fetch("/api/kitchen/demo-codes")
      .then((r) => (r.ok ? r.json() : { codes: {} }))
      .then((d) => live && setCodes(d.codes ?? {}))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return codes;
}
