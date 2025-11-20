/*
  Warnings:

  - A unique constraint covering the columns `[sectionId,fieldName,parentId]` on the table `Template_Field` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DSFMS"."Template_Field_sectionId_fieldName_key";

-- CreateIndex
CREATE UNIQUE INDEX "Template_Field_sectionId_fieldName_parentId_key" ON "DSFMS"."Template_Field"("sectionId", "fieldName", "parentId");
