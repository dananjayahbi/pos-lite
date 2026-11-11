-- Historical cost on sale lines. P&L COGS must use the cost that applied when
-- the sale happened, not the variant's current costPrice (which changes when
-- purchasing prices are updated). Legacy rows keep NULL and reports fall back
-- to the current cost.
ALTER TABLE "sale_lines" ADD COLUMN "costPriceSnapshot" DECIMAL(12,2);
