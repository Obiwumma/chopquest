-- Cache for AI answers (OpenRouter), keyed by a hash of what we asked, so the same dish or kitchen
-- card never spends credits twice. Stores the parsed JSON only, never photos.
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key    TEXT PRIMARY KEY,          -- "<task>:<sha256 of the input>"
  result       TEXT NOT NULL,             -- parsed JSON answer
  model        TEXT,
  tokens       INTEGER,
  cost_usd     REAL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
