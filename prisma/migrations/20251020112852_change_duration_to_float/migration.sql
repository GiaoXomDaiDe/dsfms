/*
  Warnings:

  - You are about to alter the column `duration` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "DSFMS"."Subject" ALTER COLUMN "duration" SET DATA TYPE DOUBLE PRECISION;
