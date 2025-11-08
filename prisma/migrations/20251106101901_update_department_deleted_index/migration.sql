-- DropIndex
DROP INDEX "DSFMS"."Department_deletedAt_idx";

-- Tạo lại dưới dạng unique partial index cho bộ (id, isActive, deletedAt)
CREATE UNIQUE INDEX "Department_deletedAt_idx"
ON "DSFMS"."Department" ("id", "isActive", "deletedAt")
WHERE "deletedAt" IS NULL AND "isActive" = true;