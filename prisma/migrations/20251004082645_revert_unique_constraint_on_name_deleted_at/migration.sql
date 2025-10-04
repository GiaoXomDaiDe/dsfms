-- This is an empty migration.
-- DropIndex
DROP INDEX "DSFMS"."Role_name_unique_when_not_deleted";

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "DSFMS"."Role"("name");