/*
  Warnings:

  - You are about to drop the column `isActive` on the `Template_Form` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Template_Form` will be added. If there are existing duplicate values, this will fail.
  - Made the column `templateContent` on table `Template_Form` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "DSFMS"."TemplateStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DISABLED', 'REJECTED');

-- DropIndex
DROP INDEX "DSFMS"."Template_Form_isActive_idx";

-- AlterTable
ALTER TABLE "DSFMS"."Template_Form" DROP COLUMN "isActive",
ADD COLUMN     "referFirstVersionId" UUID,
ADD COLUMN     "status" "DSFMS"."TemplateStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "departmentId" DROP NOT NULL,
ALTER COLUMN "templateContent" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Template_Form_name_key" ON "DSFMS"."Template_Form"("name");

-- CreateIndex
CREATE INDEX "Template_Form_status_idx" ON "DSFMS"."Template_Form"("status");

-- CreateIndex
CREATE INDEX "Template_Form_referFirstVersionId_idx" ON "DSFMS"."Template_Form"("referFirstVersionId");

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Form" ADD CONSTRAINT "Template_Form_referFirstVersionId_fkey" FOREIGN KEY ("referFirstVersionId") REFERENCES "DSFMS"."Template_Form"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
