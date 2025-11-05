-- DropIndex
DROP INDEX "DSFMS"."Permission_deletedAt_idx";


-- Tạo lại dưới dạng unique partial index cho bộ (id, isActive, deletedAt)
CREATE UNIQUE INDEX "Permission_deletedAt_idx"
ON "DSFMS"."Permission" ("id", "isActive", "deletedAt")
WHERE "deletedAt" IS NULL AND "isActive" = true;