-- Allow owner and manager sales created outside the POS shift workflow.
ALTER TABLE "sales"
  ALTER COLUMN "shiftId" DROP NOT NULL;
