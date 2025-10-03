-- CreateEnum
CREATE TYPE "DSFMS"."FieldType" AS ENUM ('TEXT', 'IMAGE', 'PART', 'TOGGLE', 'SECTION_CONTROL_TOGGLE', 'VALUE_LIST', 'SIGNATURE_DRAW', 'SIGNATURE_IMG', 'FINAL_SCORE_TEXT', 'FINAL_SCORE_NUM');

-- CreateEnum
CREATE TYPE "DSFMS"."RoleRequired" AS ENUM ('TRAINEE', 'TRAINER');

-- CreateTable
CREATE TABLE "DSFMS"."Global_Field" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(255) NOT NULL,
    "fieldName" VARCHAR(255) NOT NULL,
    "fieldType" "DSFMS"."FieldType" NOT NULL,
    "roleRequired" "DSFMS"."RoleRequired",
    "options" JSONB,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "Global_Field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Global_Field_parentId_idx" ON "DSFMS"."Global_Field"("parentId");

-- CreateIndex
CREATE INDEX "Global_Field_fieldType_idx" ON "DSFMS"."Global_Field"("fieldType");

-- CreateIndex
CREATE INDEX "Global_Field_createdById_idx" ON "DSFMS"."Global_Field"("createdById");

-- CreateIndex
CREATE INDEX "Global_Field_updatedById_idx" ON "DSFMS"."Global_Field"("updatedById");

-- AddForeignKey
ALTER TABLE "DSFMS"."Global_Field" ADD CONSTRAINT "Global_Field_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DSFMS"."Global_Field"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Global_Field" ADD CONSTRAINT "Global_Field_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Global_Field" ADD CONSTRAINT "Global_Field_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
