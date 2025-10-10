/*
  Warnings:

  - The `status` column on the `Subject` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Subject" DROP COLUMN "status",
ADD COLUMN     "status" "DSFMS"."SubjectStatus" NOT NULL DEFAULT 'PLANNED';
