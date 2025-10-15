/*
  Warnings:

  - Made the column `courseId` on table `Subject` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Subject" ALTER COLUMN "courseId" SET NOT NULL;
