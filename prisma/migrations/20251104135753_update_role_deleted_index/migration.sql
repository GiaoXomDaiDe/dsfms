-- Xoá index cũ được tạo tự động
DROP INDEX IF EXISTS "Role_deletedAt_idx";

-- Tạo lại dưới dạng unique partial index cho bộ (id, isActive, deletedAt)
CREATE UNIQUE INDEX "Role_deletedAt_idx"
ON "DSFMS"."Role" ("id", "isActive", "deletedAt")
WHERE "deletedAt" IS NULL AND "isActive" = true;