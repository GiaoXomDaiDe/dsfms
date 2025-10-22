/*
  Warnings:

  - The values [SUSPENDED] on the enum `UserStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DSFMS"."UserStatus_new" AS ENUM ('ACTIVE', 'DISABLED');
ALTER TABLE "DSFMS"."User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DSFMS"."User" ALTER COLUMN "status" TYPE "DSFMS"."UserStatus_new" USING ("status"::text::"DSFMS"."UserStatus_new");
ALTER TYPE "DSFMS"."UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "DSFMS"."UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "DSFMS"."UserStatus_old";
ALTER TABLE "DSFMS"."User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
