-- CreateEnum
CREATE TYPE "DSFMS"."EditByRole" AS ENUM ('TRAINEE', 'TRAINER');

-- CreateEnum
CREATE TYPE "DSFMS"."RoleInSubject" AS ENUM ('ASSESSMENT_REVIEWER', 'EXAMINER');

-- AlterEnum
ALTER TYPE "DSFMS"."FieldType" ADD VALUE 'CHECK_BOX';

-- DropIndex
DROP INDEX "DSFMS"."Role_name_key";

-- CreateTable
CREATE TABLE "DSFMS"."Template_Form" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "departmentId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateContent" VARCHAR(500),
    "templateSchema" JSONB,

    CONSTRAINT "Template_Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Template_Section" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "editBy" "DSFMS"."EditByRole" NOT NULL,
    "roleInSubject" "DSFMS"."RoleInSubject",
    "isSubmittable" BOOLEAN NOT NULL DEFAULT false,
    "isToggleDependent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Template_Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Template_Field" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sectionId" UUID NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "fieldName" VARCHAR(255) NOT NULL,
    "fieldType" "DSFMS"."FieldType" NOT NULL,
    "roleRequired" "DSFMS"."RoleRequired",
    "options" JSONB,
    "displayOrder" INTEGER NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "Template_Field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_Form_departmentId_idx" ON "DSFMS"."Template_Form"("departmentId");

-- CreateIndex
CREATE INDEX "Template_Form_createdByUserId_idx" ON "DSFMS"."Template_Form"("createdByUserId");

-- CreateIndex
CREATE INDEX "Template_Form_isActive_idx" ON "DSFMS"."Template_Form"("isActive");

-- CreateIndex
CREATE INDEX "Template_Section_templateId_idx" ON "DSFMS"."Template_Section"("templateId");

-- CreateIndex
CREATE INDEX "Template_Section_displayOrder_idx" ON "DSFMS"."Template_Section"("displayOrder");

-- CreateIndex
CREATE INDEX "Template_Field_sectionId_idx" ON "DSFMS"."Template_Field"("sectionId");

-- CreateIndex
CREATE INDEX "Template_Field_parentId_idx" ON "DSFMS"."Template_Field"("parentId");

-- CreateIndex
CREATE INDEX "Template_Field_displayOrder_idx" ON "DSFMS"."Template_Field"("displayOrder");

-- CreateIndex
CREATE INDEX "Template_Field_createdById_idx" ON "DSFMS"."Template_Field"("createdById");

-- CreateIndex
CREATE INDEX "Template_Field_updatedById_idx" ON "DSFMS"."Template_Field"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Template_Field_sectionId_fieldName_key" ON "DSFMS"."Template_Field"("sectionId", "fieldName");

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Form" ADD CONSTRAINT "Template_Form_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DSFMS"."Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Form" ADD CONSTRAINT "Template_Form_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "DSFMS"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Section" ADD CONSTRAINT "Template_Section_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DSFMS"."Template_Form"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Field" ADD CONSTRAINT "Template_Field_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DSFMS"."Template_Section"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Field" ADD CONSTRAINT "Template_Field_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DSFMS"."Template_Field"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Field" ADD CONSTRAINT "Template_Field_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Field" ADD CONSTRAINT "Template_Field_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
