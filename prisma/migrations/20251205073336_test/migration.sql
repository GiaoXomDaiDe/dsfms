/*
  Warnings:

  - You are about to drop the `_Endpoint_Permission_To_Role` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_Endpoint_Permission_To_Role" DROP CONSTRAINT "_Endpoint_Permission_To_Role_A_fkey";

-- DropForeignKey
ALTER TABLE "_Endpoint_Permission_To_Role" DROP CONSTRAINT "_Endpoint_Permission_To_Role_B_fkey";

-- DropTable
DROP TABLE "_Endpoint_Permission_To_Role";

-- CreateTable
CREATE TABLE "_EndpointPermissionToRole" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EndpointPermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_EndpointPermissionToRole_B_index" ON "_EndpointPermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "_EndpointPermissionToRole" ADD CONSTRAINT "_EndpointPermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Endpoint_Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EndpointPermissionToRole" ADD CONSTRAINT "_EndpointPermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
