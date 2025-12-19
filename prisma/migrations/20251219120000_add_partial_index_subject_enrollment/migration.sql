-- Add partial index for active enrollments to speed duplicate checks and avoid full-table scans
-- Covers subjectId + traineeUserId + batchCode when status is ENROLLED or ON_GOING

CREATE INDEX "Subject_Enrollment_active_idx"
  ON "Subject_Enrollment" ("subjectId", "traineeUserId", "batchCode")
  WHERE "status" IN ('ENROLLED', 'ON_GOING');
