-- Add partial unique constraint for eid field in User table
-- This constraint ensures eid is unique only for non-deleted records (deletedAt IS NULL)
CREATE UNIQUE INDEX CONCURRENTLY "User_eid_unique_partial" ON "User" ("eid") WHERE "deletedAt" IS NULL;