-- Rename legacy "Request" table to the new physical name "report"
ALTER TABLE "Request" RENAME TO "Report";

-- Update index names to match the renamed table for clarity
ALTER INDEX "Request_requestType_idx" RENAME TO "report_requestType_idx";
ALTER INDEX "Request_status_idx" RENAME TO "report_status_idx";
ALTER INDEX "Request_createdById_idx" RENAME TO "report_createdById_idx";
ALTER INDEX "Request_managedById_idx" RENAME TO "report_managedById_idx";
ALTER INDEX "Request_createdAt_idx" RENAME TO "report_createdAt_idx";
