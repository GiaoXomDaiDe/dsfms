-- CreateTable
CREATE TABLE "DSFMS"."_PermissionToRole" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "DSFMS"."_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "DSFMS"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "DSFMS"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "DSFMS"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
