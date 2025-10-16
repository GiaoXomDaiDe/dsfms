-- CreateEnum
CREATE TYPE "DSFMS"."RequestType" AS ENUM ('SAFETY_REPORT', 'INCIDENT_REPORT', 'FEEDBACK_REPORT', 'ASSESSMENT_APPROVAL_REQUEST');

-- CreateEnum
CREATE TYPE "DSFMS"."RequestSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DSFMS"."RequestStatus" AS ENUM ('CREATED', 'ACKNOWLEDGED', 'RESOLVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DSFMS"."AssessmentStatus" AS ENUM ('NOT_STARTED', 'ON_GOING', 'SIGNATURE_PENDING', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DSFMS"."AssessmentResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "DSFMS"."AssessmentSectionStatus" AS ENUM ('REQUIRED_ASSESSMENT', 'DRAFT', 'REJECTED', 'APPROVED');

-- CreateTable
CREATE TABLE "DSFMS"."Assessment_Form" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subjectId" UUID,
    "courseId" UUID,
    "occuranceDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "traineeId" UUID NOT NULL,
    "status" "DSFMS"."AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submittedAt" TIMESTAMP(3),
    "comment" VARCHAR(1000),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "isTraineeLocked" BOOLEAN NOT NULL DEFAULT true,
    "resultScore" DOUBLE PRECISION,
    "resultText" "DSFMS"."AssessmentResult",
    "pdfUrl" VARCHAR(500),

    CONSTRAINT "Assessment_Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Assessment_Section" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentFormId" UUID NOT NULL,
    "assessedById" UUID,
    "templateSectionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DSFMS"."AssessmentSectionStatus" NOT NULL DEFAULT 'REQUIRED_ASSESSMENT',

    CONSTRAINT "Assessment_Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requestType" "DSFMS"."RequestType" NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "severity" "DSFMS"."RequestSeverity",
    "title" TEXT,
    "description" TEXT,
    "actionsTaken" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "DSFMS"."RequestStatus" NOT NULL DEFAULT 'CREATED',
    "managedByUserId" UUID,
    "response" TEXT,
    "assessmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Assessment_Value" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentSectionId" UUID NOT NULL,
    "templateFieldId" UUID NOT NULL,
    "answerValue" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "Assessment_Value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_Form_createdById_idx" ON "DSFMS"."Assessment_Form"("createdById");

-- CreateIndex
CREATE INDEX "Assessment_Form_updatedById_idx" ON "DSFMS"."Assessment_Form"("updatedById");

-- CreateIndex
CREATE INDEX "Assessment_Form_templateId_idx" ON "DSFMS"."Assessment_Form"("templateId");

-- CreateIndex
CREATE INDEX "Assessment_Form_subjectId_idx" ON "DSFMS"."Assessment_Form"("subjectId");

-- CreateIndex
CREATE INDEX "Assessment_Form_courseId_idx" ON "DSFMS"."Assessment_Form"("courseId");

-- CreateIndex
CREATE INDEX "Assessment_Form_traineeId_idx" ON "DSFMS"."Assessment_Form"("traineeId");

-- CreateIndex
CREATE INDEX "Assessment_Form_approvedById_idx" ON "DSFMS"."Assessment_Form"("approvedById");

-- CreateIndex
CREATE INDEX "Assessment_Form_status_idx" ON "DSFMS"."Assessment_Form"("status");

-- CreateIndex
CREATE INDEX "Assessment_Form_occuranceDate_idx" ON "DSFMS"."Assessment_Form"("occuranceDate");

-- CreateIndex
CREATE INDEX "Assessment_Section_assessmentFormId_idx" ON "DSFMS"."Assessment_Section"("assessmentFormId");

-- CreateIndex
CREATE INDEX "Assessment_Section_assessedById_idx" ON "DSFMS"."Assessment_Section"("assessedById");

-- CreateIndex
CREATE INDEX "Assessment_Section_templateSectionId_idx" ON "DSFMS"."Assessment_Section"("templateSectionId");

-- CreateIndex
CREATE INDEX "Assessment_Section_status_idx" ON "DSFMS"."Assessment_Section"("status");

-- CreateIndex
CREATE INDEX "Request_requestType_idx" ON "DSFMS"."Request"("requestType");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "DSFMS"."Request"("status");

-- CreateIndex
CREATE INDEX "Request_createdByUserId_idx" ON "DSFMS"."Request"("createdByUserId");

-- CreateIndex
CREATE INDEX "Request_managedByUserId_idx" ON "DSFMS"."Request"("managedByUserId");

-- CreateIndex
CREATE INDEX "Request_createdAt_idx" ON "DSFMS"."Request"("createdAt");

-- CreateIndex
CREATE INDEX "Assessment_Value_assessmentSectionId_idx" ON "DSFMS"."Assessment_Value"("assessmentSectionId");

-- CreateIndex
CREATE INDEX "Assessment_Value_templateFieldId_idx" ON "DSFMS"."Assessment_Value"("templateFieldId");

-- CreateIndex
CREATE INDEX "Assessment_Value_createdById_idx" ON "DSFMS"."Assessment_Value"("createdById");

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DSFMS"."Template_Form"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DSFMS"."Subject"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Form" ADD CONSTRAINT "Assessment_Form_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DSFMS"."Course"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Section" ADD CONSTRAINT "Assessment_Section_assessmentFormId_fkey" FOREIGN KEY ("assessmentFormId") REFERENCES "DSFMS"."Assessment_Form"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Section" ADD CONSTRAINT "Assessment_Section_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Section" ADD CONSTRAINT "Assessment_Section_templateSectionId_fkey" FOREIGN KEY ("templateSectionId") REFERENCES "DSFMS"."Template_Section"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_managedByUserId_fkey" FOREIGN KEY ("managedByUserId") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Request" ADD CONSTRAINT "Request_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DSFMS"."Assessment_Form"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Value" ADD CONSTRAINT "Assessment_Value_assessmentSectionId_fkey" FOREIGN KEY ("assessmentSectionId") REFERENCES "DSFMS"."Assessment_Section"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Value" ADD CONSTRAINT "Assessment_Value_templateFieldId_fkey" FOREIGN KEY ("templateFieldId") REFERENCES "DSFMS"."Template_Field"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Assessment_Value" ADD CONSTRAINT "Assessment_Value_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
