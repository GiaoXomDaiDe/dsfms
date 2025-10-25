-- Manual migration: Ensure duration always has 2 decimal places

-- Step 1: Update existing data to have exactly 2 decimal places
UPDATE "Subject"
SET duration = ROUND(duration, 2)
WHERE duration IS NOT NULL;

-- Step 2: Create trigger function to auto-round duration on INSERT/UPDATE
CREATE OR REPLACE FUNCTION round_subject_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.duration IS NOT NULL THEN
        NEW.duration := ROUND(NEW.duration, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to enforce format
DROP TRIGGER IF EXISTS ensure_duration_format ON "Subject";
CREATE TRIGGER ensure_duration_format
    BEFORE INSERT OR UPDATE OF duration ON "Subject"
    FOR EACH ROW
    EXECUTE FUNCTION round_subject_duration();
