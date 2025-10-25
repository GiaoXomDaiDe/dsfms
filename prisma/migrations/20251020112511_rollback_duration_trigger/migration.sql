-- Drop trigger and function before changing column type
DROP TRIGGER IF EXISTS ensure_duration_format ON "DSFMS"."Subject";
DROP FUNCTION IF EXISTS round_subject_duration();