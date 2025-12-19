-- Change primary key to include batchCode
ALTER TABLE "Subject_Enrollment" DROP CONSTRAINT "Subject_Enrollment_pkey";
ALTER TABLE "Subject_Enrollment"
  ADD CONSTRAINT "Subject_Enrollment_pkey" PRIMARY KEY ("traineeUserId", "subjectId", "batchCode");
