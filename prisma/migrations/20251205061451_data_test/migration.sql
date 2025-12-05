/*
  Rename permission tables and their supporting constraints/indexes to the
  PascalCase-with-underscores format without dropping data.
*/

-- Rename the core tables
ALTER TABLE "EndpointPermission" RENAME TO "Endpoint_Permission";
ALTER TABLE "PermissionGroup" RENAME TO "Permission_Group";
ALTER TABLE "PermissionGroupToEndpointPermission" RENAME TO "Permission_Group_To_Endpoint_Permission";
ALTER TABLE IF EXISTS "_EndpointPermissionToRole" RENAME TO "_Endpoint_Permission_To_Role";

-- Primary keys
ALTER TABLE "Endpoint_Permission" RENAME CONSTRAINT "EndpointPermission_pkey" TO "Endpoint_Permission_pkey";
ALTER TABLE "Permission_Group" RENAME CONSTRAINT "PermissionGroup_pkey" TO "Permission_Group_pkey";
ALTER TABLE "Permission_Group_To_Endpoint_Permission" RENAME CONSTRAINT "PermissionGroupToEndpointPermission_pkey" TO "Permission_Group_To_Endpoint_Permission_pkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_EndpointPermissionToRole_AB_pkey'
  ) THEN
    EXECUTE 'ALTER TABLE "_Endpoint_Permission_To_Role" RENAME CONSTRAINT "_EndpointPermissionToRole_AB_pkey" TO "_Endpoint_Permission_To_Role_AB_pkey"';
  END IF;
END $$;

-- Foreign keys on Endpoint_Permission
ALTER TABLE "Endpoint_Permission" RENAME CONSTRAINT "EndpointPermission_createdById_fkey" TO "Endpoint_Permission_createdById_fkey";
ALTER TABLE "Endpoint_Permission" RENAME CONSTRAINT "EndpointPermission_deletedById_fkey" TO "Endpoint_Permission_deletedById_fkey";
ALTER TABLE "Endpoint_Permission" RENAME CONSTRAINT "EndpointPermission_updatedById_fkey" TO "Endpoint_Permission_updatedById_fkey";

-- Foreign keys on Permission_Group_To_Endpoint_Permission
ALTER TABLE "Permission_Group_To_Endpoint_Permission" RENAME CONSTRAINT "PermissionGroupToEndpointPermission_endpointPermissionId_fkey" TO "Permission_Group_To_Endpoint_Permission_endpointPermission_fkey";
ALTER TABLE "Permission_Group_To_Endpoint_Permission" RENAME CONSTRAINT "PermissionGroupToEndpointPermission_permissionGroupId_fkey" TO "Permission_Group_To_Endpoint_Permission_permissionGroupId_fkey";

-- Index and foreign keys for the implicit join table (with fallbacks)
ALTER INDEX IF EXISTS "_EndpointPermissionToRole_B_index" RENAME TO "_Endpoint_Permission_To_Role_B_index";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_EndpointPermissionToRole_A_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "_Endpoint_Permission_To_Role" RENAME CONSTRAINT "_EndpointPermissionToRole_A_fkey" TO "_Endpoint_Permission_To_Role_A_fkey"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_EndpointPermissionToRole_B_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "_Endpoint_Permission_To_Role" RENAME CONSTRAINT "_EndpointPermissionToRole_B_fkey" TO "_Endpoint_Permission_To_Role_B_fkey"';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = '_Endpoint_Permission_To_Role'
  ) THEN
    CREATE TABLE "_Endpoint_Permission_To_Role" (
      "A" UUID NOT NULL,
      "B" UUID NOT NULL,
      CONSTRAINT "_Endpoint_Permission_To_Role_AB_pkey" PRIMARY KEY ("A","B")
    );

    CREATE INDEX "_Endpoint_Permission_To_Role_B_index" ON "_Endpoint_Permission_To_Role"("B");

    ALTER TABLE "_Endpoint_Permission_To_Role"
      ADD CONSTRAINT "_Endpoint_Permission_To_Role_A_fkey"
      FOREIGN KEY ("A") REFERENCES "Endpoint_Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "_Endpoint_Permission_To_Role"
      ADD CONSTRAINT "_Endpoint_Permission_To_Role_B_fkey"
      FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Unique index rename
ALTER INDEX "PermissionGroup_permissionGroupCode_key" RENAME TO "Permission_Group_permissionGroupCode_key";
