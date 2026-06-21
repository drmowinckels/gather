-- samkoma schema: polls + responses
-- A poll is a stateless resource keyed by a short id. No user accounts; the
-- edit_token gates poll settings + lock-in. Responses hold each respondent's
-- painted availability as a JSON array of slot keys.

CREATE TABLE polls (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  days         TEXT NOT NULL,           -- JSON array of "YYYY-MM-DD"
  from_time    TEXT NOT NULL,           -- "HH:MM"
  to_time      TEXT NOT NULL,           -- "HH:MM"
  slot_minutes INTEGER NOT NULL,
  tz           TEXT NOT NULL,           -- canonical IANA timezone
  is_public    INTEGER NOT NULL DEFAULT 0,
  edit_token   TEXT NOT NULL,
  created_at   TEXT NOT NULL            -- ISO 8601
);

CREATE TABLE responses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  tz         TEXT NOT NULL,
  slots      TEXT NOT NULL,             -- JSON array of slot keys
  updated_at TEXT NOT NULL,
  UNIQUE (poll_id, name)
);

CREATE INDEX idx_responses_poll ON responses(poll_id);
