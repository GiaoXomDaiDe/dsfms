/*
  Warnings:

  - Added the required column `updatedByUserId` to the `Template_Form` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add column with temporary default, then update existing records
ALTER TABLE "DSFMS"."Template_Form" ADD COLUMN     "updatedByUserId" UUID;

-- Update existing records to set updatedByUserId same as createdByUserId for existing templates
UPDATE "DSFMS"."Template_Form" SET "updatedByUserId" = "createdByUserId" WHERE "updatedByUserId" IS NULL;

-- Make the column NOT NULL after updating existing records
ALTER TABLE "DSFMS"."Template_Form" ALTER COLUMN "updatedByUserId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Form" ADD CONSTRAINT "Template_Form_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "DSFMS"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
