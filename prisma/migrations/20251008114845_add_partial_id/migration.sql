-- AlterTable
ALTER TABLE "DSFMS"."Course" ALTER COLUMN "departmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DSFMS"."Subject" ALTER COLUMN "courseId" DROP NOT NULL;
