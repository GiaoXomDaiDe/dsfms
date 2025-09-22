-- DropIndex
DROP INDEX "DSFMS"."Role_name_deletedAt_key";

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_unique_when_not_deleted" 
ON "DSFMS"."Role"("name") 
WHERE "deletedAt" IS NULL;