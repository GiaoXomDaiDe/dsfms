-- Drop old PK (traineeUserId, subjectId, batchCode)
ALTER TABLE "Subject_Enrollment" DROP CONSTRAINT "Subject_Enrollment_pkey";

-- Add new PK (traineeUserId, subjectId)
ALTER TABLE "Subject_Enrollment" ADD CONSTRAINT "Subject_Enrollment_pkey" PRIMARY KEY ("traineeUserId", "subjectId");
