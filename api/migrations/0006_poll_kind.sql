-- Two poll kinds: "dates" (specific calendar dates, the original) and
-- "weekdays" (generic days of the week, e.g. mon/wed/fri). For weekday polls,
-- `days` holds weekday tokens and slot keys look like "monT09:00".
ALTER TABLE polls ADD COLUMN kind TEXT NOT NULL DEFAULT 'dates';
