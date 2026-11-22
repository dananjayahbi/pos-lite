-- Appointment services need an explicit tax rule so a converted sale has a
-- documented VAT/SSCL/exempt basis instead of an unexplained zero (ARGUS #131).
ALTER TABLE "appointment_services"
  ADD COLUMN IF NOT EXISTS "taxRule" "TaxRule" NOT NULL DEFAULT 'STANDARD_VAT';
