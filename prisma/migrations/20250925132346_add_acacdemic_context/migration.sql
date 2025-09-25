/*
  Warnings:

  - The `isActive` column on the `Department` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isActive` column on the `Permission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isActive` column on the `Role` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DSFMS"."ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DSFMS"."SubjectInstructorRole" AS ENUM ('PRIMARY_INSTRUCTOR', 'EXAMINER', 'ASSESSMENT_REVIEWER', 'ASSISTANT_INSTRUCTOR');

-- CreateEnum
CREATE TYPE "DSFMS"."CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "DSFMS"."CourseStatus" AS ENUM ('PLANNED', 'ON_GOING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DSFMS"."SubjectMethod" AS ENUM ('E_LEARNING', 'CLASSROOM', 'ERO');

-- CreateEnum
CREATE TYPE "DSFMS"."SubjectType" AS ENUM ('UNLIMIT', 'RECURRENT');

-- CreateEnum
CREATE TYPE "DSFMS"."SubjectEnrollmentStatus" AS ENUM ('ENROLLED', 'ON_GOING', 'CANCELLED', 'FINISHED');

-- AlterTable
ALTER TABLE "DSFMS"."Department" DROP COLUMN "isActive",
ADD COLUMN     "isActive" "DSFMS"."ActiveStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "DSFMS"."Permission" DROP COLUMN "isActive",
ADD COLUMN     "isActive" "DSFMS"."ActiveStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "DSFMS"."Role" DROP COLUMN "isActive",
ADD COLUMN     "isActive" "DSFMS"."ActiveStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "DSFMS"."Course" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "departmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "maxNumTrainee" INTEGER,
    "venue" TEXT,
    "note" TEXT,
    "passScore" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "level" "DSFMS"."CourseLevel" NOT NULL,
    "status" "DSFMS"."CourseStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "deletedById" UUID,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Subject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "method" "DSFMS"."SubjectMethod" NOT NULL,
    "duration" INTEGER,
    "type" "DSFMS"."SubjectType" NOT NULL,
    "roomName" TEXT,
    "remarkNote" TEXT,
    "timeSlot" TEXT,
    "isSIM" BOOLEAN NOT NULL DEFAULT false,
    "passScore" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "deletedById" UUID,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Subject_Instructor" (
    "trainerUserId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "roleInSubject" "DSFMS"."SubjectInstructorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_Instructor_pkey" PRIMARY KEY ("trainerUserId","subjectId")
);

-- CreateTable
CREATE TABLE "DSFMS"."Subject_Enrollment" (
    "traineeUserId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "enrollmentDate" TIMESTAMP(3) NOT NULL,
    "batchCode" TEXT NOT NULL,
    "status" "DSFMS"."SubjectEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_Enrollment_pkey" PRIMARY KEY ("traineeUserId","subjectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "DSFMS"."Course"("code");

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "DSFMS"."Course"("departmentId");

-- CreateIndex
CREATE INDEX "Course_deletedAt_idx" ON "DSFMS"."Course"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "DSFMS"."Subject"("code");

-- CreateIndex
CREATE INDEX "Subject_courseId_idx" ON "DSFMS"."Subject"("courseId");

-- CreateIndex
CREATE INDEX "Subject_deletedAt_idx" ON "DSFMS"."Subject"("deletedAt");

-- CreateIndex
CREATE INDEX "Subject_Instructor_subjectId_idx" ON "DSFMS"."Subject_Instructor"("subjectId");

-- CreateIndex
CREATE INDEX "Subject_Enrollment_subjectId_idx" ON "DSFMS"."Subject_Enrollment"("subjectId");

-- AddForeignKey
ALTER TABLE "DSFMS"."Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DSFMS"."Department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Course" ADD CONSTRAINT "Course_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Course" ADD CONSTRAINT "Course_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject" ADD CONSTRAINT "Subject_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DSFMS"."Course"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject" ADD CONSTRAINT "Subject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject" ADD CONSTRAINT "Subject_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject" ADD CONSTRAINT "Subject_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Instructor" ADD CONSTRAINT "Subject_Instructor_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "DSFMS"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Instructor" ADD CONSTRAINT "Subject_Instructor_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DSFMS"."Subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Enrollment" ADD CONSTRAINT "Subject_Enrollment_traineeUserId_fkey" FOREIGN KEY ("traineeUserId") REFERENCES "DSFMS"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Enrollment" ADD CONSTRAINT "Subject_Enrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DSFMS"."Subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
