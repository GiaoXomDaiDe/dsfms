/*
  Warnings:

  - The values [OTHER] on the enum `ReportType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReportType_new" AS ENUM ('SAFETY_REPORT', 'INSTRUCTOR_REPORT', 'FATIGUE_REPORT', 'TRAINING_PROGRAM_REPORT', 'FACILITIES_REPORT', 'COURSE_ORGANIZATION_REPORT', 'FEEDBACK');
ALTER TABLE "Report" ALTER COLUMN "requestType" TYPE "ReportType_new" USING ("requestType"::text::"ReportType_new");
ALTER TYPE "ReportType" RENAME TO "ReportType_old";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
DROP TYPE "DSFMS"."ReportType_old";
COMMIT;
