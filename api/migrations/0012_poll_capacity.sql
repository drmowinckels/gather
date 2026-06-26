-- Optional per-slot capacity: the most respondents a single slot should hold
-- before it reads as "full". NULL = no cap. Indicative only — not enforced.
ALTER TABLE polls ADD COLUMN capacity INTEGER;
