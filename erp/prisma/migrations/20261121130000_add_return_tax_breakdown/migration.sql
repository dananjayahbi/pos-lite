-- Returns must refund the tax that was actually collected (ARGUS #90). The
-- sale line now snapshots the tax charged on it, and the return records the
-- tax component of the refund so receipts and reports can show it.
ALTER TABLE "sale_lines" ADD COLUMN "lineTax" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "returns" ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "return_lines" ADD COLUMN "lineTaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
