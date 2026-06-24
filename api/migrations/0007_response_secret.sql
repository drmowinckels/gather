-- Per-respondent ownership: a PBKDF2 hash of the secret that claimed this name.
-- The first writer of a name claims it — with their own password, or an
-- auto-minted token returned once for same-browser editing. NULL = unclaimed
-- (legacy rows written before this migration; the next writer claims them).
ALTER TABLE responses ADD COLUMN secret_hash TEXT;
