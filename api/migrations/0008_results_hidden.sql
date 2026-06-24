-- Hidden-results mode: a host-controlled curtain over the aggregate. When 1,
-- only the host (edit token) sees results — even on a public poll — until the
-- host reveals them. Distinct from `is_public`, which controls whether anyone
-- but the host can ever see results.
ALTER TABLE polls ADD COLUMN results_hidden INTEGER NOT NULL DEFAULT 0;
