/*
  Warnings:

  - A unique constraint covering the columns `[eid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_eid_key" ON "DSFMS"."User"("eid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "DSFMS"."User"("email");
