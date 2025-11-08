/*
  Warnings:

  - A unique constraint covering the columns `[trainerUserId,courseId]` on the table `Assessment_Examiners` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "assessment_examiner_trainer_course_key" ON "DSFMS"."Assessment_Examiners"("trainerUserId", "courseId");

-- RenameIndex
ALTER INDEX "DSFMS"."Assessment_Examiners_trainerUserId_subjectId_key" RENAME TO "assessment_examiner_trainer_subject_key";

ALTER TABLE "DSFMS"."Assessment_Examiners"
  ADD CONSTRAINT assessment_examiner_scope_chk CHECK ("courseId" IS NOT NULL OR "subjectId" IS NOT NULL);