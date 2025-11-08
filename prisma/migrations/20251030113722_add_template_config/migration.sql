/*
  Warnings:

  - Added the required column `templateConfig` to the `Template_Form` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add column with temporary default value
ALTER TABLE "DSFMS"."Template_Form" ADD COLUMN     "templateConfig" VARCHAR(500) NOT NULL DEFAULT '';

-- Update existing records with placeholder values (you may want to update these manually later)
UPDATE "DSFMS"."Template_Form" SET "templateConfig" = 'https://placeholder-s3-url.com/template-' || "id" || '.docx';

-- Remove the default constraint
ALTER TABLE "DSFMS"."Template_Form" ALTER COLUMN "templateConfig" DROP DEFAULT;
