-- Polls auto-expire 14 days after their last day. expires_at is an ISO date
-- (YYYY-MM-DD); NULL means never expires (legacy rows). A daily cron deletes
-- rows past expiry.
ALTER TABLE polls ADD COLUMN expires_at TEXT;
CREATE INDEX idx_polls_expires ON polls(expires_at);
