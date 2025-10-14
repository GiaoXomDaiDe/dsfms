/*
  Warnings:

  - Made the column `departmentId` on table `Course` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Course" ALTER COLUMN "departmentId" SET NOT NULL;
