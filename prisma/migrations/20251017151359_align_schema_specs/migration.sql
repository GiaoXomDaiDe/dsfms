/*
  Warnings:

  - The `isActive` column on the `Department` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isActive` column on the `Permission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `createdByUserId` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `managedByUserId` on the `Request` table. All the data in the column will be lost.
  - The `isActive` column on the `Role` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[path]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "DSFMS"."FieldType" ADD VALUE 'PARENT';

-- DropForeignKey
ALTER TABLE "DSFMS"."Request" DROP CONSTRAINT "Request_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Request" DROP CONSTRAINT "Request_managedByUserId_fkey";

-- DropIndex
DROP INDEX "DSFMS"."Request_createdByUserId_idx";

-- DropIndex
DROP INDEX "DSFMS"."Request_managedByUserId_idx";

-- AlterTable
ALTER TABLE "DSFMS"."Department" DROP COLUMN "isActive",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DSFMS"."Permission" ALTER COLUMN "viewModule" DROP DEFAULT,
ALTER COLUMN "viewName" DROP DEFAULT,
DROP COLUMN "isActive",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DSFMS"."Request" DROP COLUMN "createdByUserId",
DROP COLUMN "managedByUserId",
ADD COLUMN     "createdById" UUID NOT NULL,
ADD COLUMN     "managedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."Role" DROP COLUMN "isActive",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DSFMS"."Trainer_Profile" ALTER COLUMN "yearsOfExp" DROP DEFAULT;

-- DropEnum
DROP TYPE "DSFMS"."ActiveStatus";


-- CreateIndex
CREATE INDEX "Request_createdById_idx" ON "DSFMS"."Request"("createdById");

-- CreateIndex
CREATE INDEX "Request_managedById_idx" ON "DSFMS"."Request"("managedById");

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
