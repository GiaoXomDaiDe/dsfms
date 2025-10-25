/*
  Warnings:

  - The values [INCIDENT_REPORT,FEEDBACK_REPORT] on the enum `RequestType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DSFMS"."RequestType_new" AS ENUM ('SAFETY_REPORT', 'INSTRUCTOR_REPORT', 'FATIGUE_REPORT', 'TRAINING_PROGRAM_REPORT', 'FACILITIES_REPORT', 'COURSE_ORGANIZATION_REPORT', 'ASSESSMENT_APPROVAL_REQUEST', 'OTHER');
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "requestType" TYPE "DSFMS"."RequestType_new" USING ("requestType"::text::"DSFMS"."RequestType_new");
ALTER TYPE "DSFMS"."RequestType" RENAME TO "RequestType_old";
ALTER TYPE "DSFMS"."RequestType_new" RENAME TO "RequestType";
DROP TYPE "DSFMS"."RequestType_old";
COMMIT;
