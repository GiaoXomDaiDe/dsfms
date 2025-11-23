-- DropIndex
DROP INDEX "PermissionGroupToEndpointPermission_endpointPermissionId_idx";

-- DropIndex
DROP INDEX "PermissionGroupToEndpointPermission_permissionGroupId_idx";

-- AlterTable
ALTER TABLE "_EndpointPermissionToRole" RENAME CONSTRAINT "_PermissionToRole_AB_pkey" TO "_EndpointPermissionToRole_AB_pkey";

-- RenameIndex
ALTER INDEX "_PermissionToRole_B_index" RENAME TO "_EndpointPermissionToRole_B_index";
