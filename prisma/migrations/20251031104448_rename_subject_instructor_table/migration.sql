-- Rename table
ALTER TABLE "DSFMS"."Subject_Instructor" RENAME TO "Assessment_Examiners";

-- Drop existing indexes that will be recreated with the new name
DROP INDEX IF EXISTS "DSFMS"."Subject_Instructor_subjectId_idx";
DROP INDEX IF EXISTS "DSFMS"."Subject_Instructor_trainerUserId_subjectId_key";

-- Drop constraints that need to be recreated with new rules
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Subject_Instructor_subjectId_fkey";
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Subject_Instructor_trainerUserId_fkey";
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Subject_Instructor_pkey";

-- Adjust columns: add id, add courseId, allow subjectId to be nullable
ALTER TABLE "DSFMS"."Assessment_Examiners"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "courseId" UUID,
  ALTER COLUMN "subjectId" DROP NOT NULL;

-- Recreate primary key on the new id column
ALTER TABLE "DSFMS"."Assessment_Examiners" ADD CONSTRAINT "Assessment_Examiners_pkey" PRIMARY KEY ("id");

CREATE INDEX "Assessment_Examiners_subjectId_idx" ON "DSFMS"."Assessment_Examiners" ("subjectId");
CREATE INDEX "Assessment_Examiners_courseId_idx" ON "DSFMS"."Assessment_Examiners" ("courseId");
CREATE UNIQUE INDEX "Assessment_Examiners_trainerUserId_subjectId_key" ON "DSFMS"."Assessment_Examiners" ("trainerUserId", "subjectId");

-- Recreate foreign keys with updated behavior
ALTER TABLE "DSFMS"."Assessment_Examiners"
  ADD CONSTRAINT "Assessment_Examiners_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "DSFMS"."Subject"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "DSFMS"."Assessment_Examiners"
  ADD CONSTRAINT "Assessment_Examiners_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "DSFMS"."Course"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "DSFMS"."Assessment_Examiners"
  ADD CONSTRAINT "Assessment_Examiners_trainerUserId_fkey"
  FOREIGN KEY ("trainerUserId") REFERENCES "DSFMS"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
