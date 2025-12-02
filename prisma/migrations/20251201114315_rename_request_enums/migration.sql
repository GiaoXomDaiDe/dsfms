/*
  Warnings:

  - The `severity` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `requestType` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- Rename the Postgres enums so we don't drop columns or data
ALTER TYPE "RequestType" RENAME TO "ReportType";
ALTER TYPE "RequestSeverity" RENAME TO "ReportSeverity";
ALTER TYPE "RequestStatus" RENAME TO "ReportStatus";

-- Update constraint names on Report table to match the new model name
ALTER TABLE "Report" RENAME CONSTRAINT "Request_pkey" TO "Report_pkey";
ALTER TABLE "Report" RENAME CONSTRAINT "Request_createdById_fkey" TO "Report_createdById_fkey";
ALTER TABLE "Report" RENAME CONSTRAINT "Request_managedById_fkey" TO "Report_managedById_fkey";
ALTER TABLE "Report" RENAME CONSTRAINT "Request_updatedById_fkey" TO "Report_updatedById_fkey";

-- Prisma created indexes back when the table was named Request; rename them to keep consistency
ALTER INDEX "report_requestType_idx" RENAME TO "Report_requestType_idx";
ALTER INDEX "report_status_idx" RENAME TO "Report_status_idx";
ALTER INDEX "report_createdAt_idx" RENAME TO "Report_createdAt_idx";
ALTER INDEX "report_createdById_idx" RENAME TO "Report_createdById_idx";
ALTER INDEX "report_managedById_idx" RENAME TO "Report_managedById_idx";
