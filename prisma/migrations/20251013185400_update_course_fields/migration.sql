/*
  Warnings:

  - Made the column `maxNumTrainee` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `startDate` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endDate` on table `Course` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Course" ALTER COLUMN "maxNumTrainee" SET NOT NULL,
ALTER COLUMN "startDate" SET NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL;
