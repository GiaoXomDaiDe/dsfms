/*
  Warnings:

  - You are about to drop the `Assessment_Examiners` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Assessment_Examiners_courseId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Assessment_Examiners_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Assessment_Examiners" DROP CONSTRAINT "Assessment_Examiners_trainerUserId_fkey";

-- DropTable
DROP TABLE "DSFMS"."Assessment_Examiners";

-- CreateTable
CREATE TABLE "DSFMS"."Subject_Instructors" (
    "trainerUserId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "roleInAssessment" "DSFMS"."RoleInSubject" NOT NULL,

    CONSTRAINT "Subject_Instructors_pkey" PRIMARY KEY ("trainerUserId","subjectId")
);

-- CreateTable
CREATE TABLE "DSFMS"."Course_Instructors" (
    "trainerUserId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "roleInAssessment" "DSFMS"."RoleInSubject" NOT NULL,

    CONSTRAINT "Course_Instructors_pkey" PRIMARY KEY ("trainerUserId","courseId")
);

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Instructors" ADD CONSTRAINT "Subject_Instructors_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "DSFMS"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Subject_Instructors" ADD CONSTRAINT "Subject_Instructors_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DSFMS"."Subject"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Course_Instructors" ADD CONSTRAINT "Course_Instructors_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "DSFMS"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Course_Instructors" ADD CONSTRAINT "Course_Instructors_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DSFMS"."Course"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
