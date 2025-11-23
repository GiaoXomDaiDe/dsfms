/*
  Migration: Rename Permission -> EndpointPermission, _PermissionToRole -> _EndpointPermissionToRole,
  rename related indexes if they exist, and create PermissionGroup + PermissionGroupToEndpointPermission.
*/

-----------------------------------------------
-- 1) ĐỔI TÊN BẢNG Permission -> EndpointPermission
-----------------------------------------------
ALTER TABLE "Permission" RENAME TO "EndpointPermission";

-- 1.1) Đổi tên PRIMARY KEY constraint nếu đang là "Permission_pkey"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Permission_pkey'
  ) THEN
    ALTER TABLE "EndpointPermission"
      RENAME CONSTRAINT "Permission_pkey" TO "EndpointPermission_pkey";
  END IF;
END$$;

-- 1.2) Đổi tên index deletedAt nếu đang là "Permission_deletedAt_idx"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'Permission_deletedAt_idx'
    AND    n.nspname = 'public'
  ) THEN
    ALTER INDEX "Permission_deletedAt_idx"
      RENAME TO "EndpointPermission_deletedAt_idx";
  END IF;
END$$;

-- 1.3) Đổi tên unique index trên (path, method)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'permission_path_method_unique'
    AND    n.nspname = 'public'
  ) THEN
    ALTER INDEX "permission_path_method_unique"
      RENAME TO "endpoint_permission_path_method_unique";
  END IF;
END$$;


-----------------------------------------------
-- 2) ĐỔI TÊN BẢNG JOIN _PermissionToRole -> _EndpointPermissionToRole
-----------------------------------------------
ALTER TABLE "_PermissionToRole" RENAME TO "_EndpointPermissionToRole";

-- 2.1) (BỎ QUA) Không rename constraint PK _PermissionToRole_AB_key nữa,
--      để tránh phụ thuộc tên constraint tồn tại trong shadow DB.
--      Nếu sau này bạn muốn rất clean, có thể chạy 1 script riêng trên DB thật:
--      ALTER TABLE "_EndpointPermissionToRole" RENAME CONSTRAINT "<tên-thật>" TO "<tên-mới>";

-- 2.2) Đổi tên index trên cột B nếu đang là "_PermissionToRole_B_index"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = '_PermissionToRole_B_index'
    AND    n.nspname = 'public'
  ) THEN
    ALTER INDEX "_PermissionToRole_B_index"
      RENAME TO "_EndpointPermissionToRole_B_index";
  END IF;
END$$;


-----------------------------------------------
-- 3) CẬP NHẬT FOREIGN KEY CHO EndpointPermission (đã rename từ Permission)
-----------------------------------------------
-- Drop FK cũ nếu tồn tại, rồi tạo lại với tên mới
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Permission_createdById_fkey'
  ) THEN
    ALTER TABLE "EndpointPermission" DROP CONSTRAINT "Permission_createdById_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Permission_deletedById_fkey'
  ) THEN
    ALTER TABLE "EndpointPermission" DROP CONSTRAINT "Permission_deletedById_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Permission_updatedById_fkey'
  ) THEN
    ALTER TABLE "EndpointPermission" DROP CONSTRAINT "Permission_updatedById_fkey";
  END IF;
END$$;

ALTER TABLE "EndpointPermission" ADD CONSTRAINT "EndpointPermission_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "EndpointPermission" ADD CONSTRAINT "EndpointPermission_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "EndpointPermission" ADD CONSTRAINT "EndpointPermission_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;


-----------------------------------------------
-- 4) CẬP NHẬT FOREIGN KEY CHO BẢNG JOIN _EndpointPermissionToRole
-----------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_PermissionToRole_A_fkey'
  ) THEN
    ALTER TABLE "_EndpointPermissionToRole" DROP CONSTRAINT "_PermissionToRole_A_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_PermissionToRole_B_fkey'
  ) THEN
    ALTER TABLE "_EndpointPermissionToRole" DROP CONSTRAINT "_PermissionToRole_B_fkey";
  END IF;
END$$;

ALTER TABLE "_EndpointPermissionToRole" ADD CONSTRAINT "_EndpointPermissionToRole_A_fkey"
  FOREIGN KEY ("A") REFERENCES "EndpointPermission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_EndpointPermissionToRole" ADD CONSTRAINT "_EndpointPermissionToRole_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Role"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-----------------------------------------------
-- 5) TẠO BẢNG MỚI: PermissionGroup
-----------------------------------------------
CREATE TABLE "PermissionGroup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "groupName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissionGroupCode" TEXT NOT NULL,
    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PermissionGroup_groupName_key"
  ON "PermissionGroup"("groupName");

-- Nếu muốn permissionGroupCode cũng unique:
-- ALTER TABLE "PermissionGroup"
--   ADD CONSTRAINT "PermissionGroup_permissionGroupCode_key" UNIQUE ("permissionGroupCode");


-----------------------------------------------
-- 6) TẠO BẢNG MAPPING: PermissionGroupToEndpointPermission
-----------------------------------------------
CREATE TABLE "PermissionGroupToEndpointPermission" (
    "permissionGroupId" UUID NOT NULL,
    "endpointPermissionId" UUID NOT NULL,
    CONSTRAINT "PermissionGroupToEndpointPermission_pkey"
      PRIMARY KEY ("permissionGroupId","endpointPermissionId")
);

ALTER TABLE "PermissionGroupToEndpointPermission"
ADD CONSTRAINT "PermissionGroupToEndpointPermission_permissionGroupId_fkey"
FOREIGN KEY ("permissionGroupId") REFERENCES "PermissionGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PermissionGroupToEndpointPermission"
ADD CONSTRAINT "PermissionGroupToEndpointPermission_endpointPermissionId_fkey"
FOREIGN KEY ("endpointPermissionId") REFERENCES "EndpointPermission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PermissionGroupToEndpointPermission_permissionGroupId_idx"
  ON "PermissionGroupToEndpointPermission"("permissionGroupId");

CREATE INDEX "PermissionGroupToEndpointPermission_endpointPermissionId_idx"
  ON "PermissionGroupToEndpointPermission"("endpointPermissionId");