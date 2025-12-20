-- Clean up any older duration triggers that might conflict
DROP TRIGGER IF EXISTS ensure_duration_format ON "Subject";
DROP FUNCTION IF EXISTS round_subject_duration();
DROP TRIGGER IF EXISTS set_subject_duration_days_trigger ON "Subject";
DROP FUNCTION IF EXISTS set_subject_duration_days();

-- Backfill duration to number of days based on start/end dates
UPDATE "Subject"
SET "duration" = ("endDate" - "startDate")::double precision;

-- Convert duration to integer days (store whole days only)
ALTER TABLE "Subject"
    ALTER COLUMN "duration" TYPE INTEGER USING ROUND("duration")::integer;

-- Ensure duration is always computed server-side on insert/update
CREATE OR REPLACE FUNCTION set_subject_duration_days()
RETURNS TRIGGER AS $$
BEGIN
    NEW."duration" := (NEW."endDate" - NEW."startDate");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_subject_duration_days_trigger
BEFORE INSERT OR UPDATE ON "Subject"
FOR EACH ROW
EXECUTE FUNCTION set_subject_duration_days();
