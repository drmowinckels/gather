-- Optional self-assigned group/team label per respondent, so results can show
-- per-group tallies. NULL = ungrouped.
ALTER TABLE responses ADD COLUMN group_name TEXT;
