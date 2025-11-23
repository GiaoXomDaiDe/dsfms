/*
  Warnings:

  - A unique constraint covering the columns `[permissionGroupCode]` on the table `PermissionGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_permissionGroupCode_key" ON "PermissionGroup"("permissionGroupCode");
