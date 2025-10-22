/*
  Warnings:

  - The values [CREATED] on the enum `RequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DSFMS"."RequestStatus_new" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'RESOLVED', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "status" TYPE "DSFMS"."RequestStatus_new" USING ("status"::text::"DSFMS"."RequestStatus_new");
ALTER TYPE "DSFMS"."RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "DSFMS"."RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "DSFMS"."RequestStatus_old";
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterTable
ALTER TABLE "DSFMS"."Request" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
