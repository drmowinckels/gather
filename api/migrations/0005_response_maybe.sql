-- Tri-state availability: `slots` holds "available" slot keys; `maybe` holds
-- "might be able to make it" slot keys (JSON array). NULL = legacy ([]).
ALTER TABLE responses ADD COLUMN maybe TEXT;
