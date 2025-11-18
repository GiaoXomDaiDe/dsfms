-- Adjust course code uniqueness to exclude archived or deleted records
DROP INDEX IF EXISTS "Course_departmentId_code_key";

CREATE UNIQUE INDEX "Course_departmentId_code_active_key" ON "Course"("departmentId", "code")
WHERE "deletedAt" IS NULL AND "status" <> 'ARCHIVED';
