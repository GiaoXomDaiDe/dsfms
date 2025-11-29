/*
  Warnings:

  - A unique constraint covering the columns `[headUserId]` on the table `Department` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Department_headUserId_key" ON "Department"("headUserId");
