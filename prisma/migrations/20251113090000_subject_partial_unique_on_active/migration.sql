-- Replace global unique constraint on courseId/code with partial unique covering active subjects only
DROP INDEX IF EXISTS "Subject_courseId_code_key";

CREATE UNIQUE INDEX "Subject_courseId_code_active_key"
  ON "DSFMS"."Subject"("courseId", "code")
  WHERE "deletedAt" IS NULL
    AND "status" <> 'ARCHIVED';
