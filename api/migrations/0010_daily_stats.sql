-- Lifetime usage counters, one row per UTC day. Polls (and their responses) are
-- auto-deleted at expiry, so COUNT(*) over polls/responses only ever reflects
-- live data. These counters are incremented at write time and never purged, so
-- they keep a permanent record of how many polls have been created and responses
-- submitted over time.
CREATE TABLE daily_stats (
  day                 TEXT PRIMARY KEY,            -- YYYY-MM-DD (UTC)
  polls_created       INTEGER NOT NULL DEFAULT 0,
  responses_submitted INTEGER NOT NULL DEFAULT 0
);
