/*
  Warnings:

  - A unique constraint covering the columns `[name,deletedAt]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Role_name_deletedAt_key" ON "DSFMS"."Role"("name", "deletedAt");
