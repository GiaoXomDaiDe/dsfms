/*
  Warnings:

  - The values [APPROVED,REJECTED] on the enum `RequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [ASSESSMENT_APPROVAL_REQUEST] on the enum `RequestType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assessmentId` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `Trainee_Profile` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RequestStatus_new" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "DSFMS"."RequestStatus_old";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RequestType_new" AS ENUM ('SAFETY_REPORT', 'INSTRUCTOR_REPORT', 'FATIGUE_REPORT', 'TRAINING_PROGRAM_REPORT', 'FACILITIES_REPORT', 'COURSE_ORGANIZATION_REPORT', 'FEEDBACK', 'OTHER');
ALTER TABLE "Request" ALTER COLUMN "requestType" TYPE "RequestType_new" USING ("requestType"::text::"RequestType_new");
ALTER TYPE "RequestType" RENAME TO "RequestType_old";
ALTER TYPE "RequestType_new" RENAME TO "RequestType";
DROP TYPE "DSFMS"."RequestType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_assessmentId_fkey";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "assessmentId";

-- AlterTable
ALTER TABLE "Trainee_Profile" DROP COLUMN "bio";
