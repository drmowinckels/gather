-- Response deadline + manual close. `deadline` (ISO timestamp) freezes new
-- responses once passed; `closed_at` (ISO timestamp) is set when the host closes
-- the poll early. Both NULL = open. Distinct from `expires_at`, which deletes
-- the poll: closing only freezes writes — the poll stays readable (200, not 410).
ALTER TABLE polls ADD COLUMN deadline TEXT;
ALTER TABLE polls ADD COLUMN closed_at TEXT;
