-- Add generated-artifact metadata to saved_reports
ALTER TABLE "saved_reports" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'pdf';
ALTER TABLE "saved_reports" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "saved_reports" ADD COLUMN "fileUrl" TEXT;
