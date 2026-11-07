-- Customer card: secondary contact, postal address, and Trans Express city.
-- All three columns are optional so existing rows remain valid.
ALTER TABLE "customers"
  ADD COLUMN "phone2" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT;
