-- Drop existing global unique indexes on course and subject codes
DROP INDEX IF EXISTS "Course_code_key";
DROP INDEX IF EXISTS "Subject_code_key";

-- Ensure codes are unique within their parent scope
CREATE UNIQUE INDEX "Course_departmentId_code_key" ON "DSFMS"."Course"("departmentId", "code");
CREATE UNIQUE INDEX "Subject_courseId_code_key" ON "DSFMS"."Subject"("courseId", "code");
