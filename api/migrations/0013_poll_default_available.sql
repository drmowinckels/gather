-- When set, respondents open to an all-available grid and paint their busy
-- times instead. NULL/0 = the usual all-busy default.
ALTER TABLE polls ADD COLUMN default_available INTEGER;
