-- CreateEnum
CREATE TYPE "DSFMS"."SubjectStatus" AS ENUM ('PLANNED', 'ON_GOING', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "DSFMS"."Subject" ADD COLUMN     "status" TEXT;
