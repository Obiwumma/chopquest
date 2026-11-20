// Load .env.local for scripts (Node 20.12+). Missing file is fine: env vars may come from the shell.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

/** Write a markdown report into team/evidence/ and print where it went. */
export async function writeReport(name: string, markdown: string) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync("team/evidence", { recursive: true });
  const path = `team/evidence/${name}`;
  writeFileSync(path, markdown, "utf8");
  console.log(`\nReport written to ${path}`);
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
export const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
export const fmt = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "n/a");
