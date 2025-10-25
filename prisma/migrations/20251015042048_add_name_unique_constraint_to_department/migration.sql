/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - Made the column `passportNo` on table `Trainee_Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `certificationNumber` on table `Trainer_Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Trainee_Profile" ALTER COLUMN "enrollmentDate" DROP NOT NULL,
ALTER COLUMN "passportNo" SET NOT NULL,
ALTER COLUMN "nation" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DSFMS"."Trainer_Profile" ALTER COLUMN "certificationNumber" SET NOT NULL,
ALTER COLUMN "yearsOfExp" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "DSFMS"."Department"("name");
