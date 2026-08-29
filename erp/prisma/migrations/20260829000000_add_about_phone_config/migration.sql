-- Add About-page phone CTA config columns to website_configs.
-- These power the "Connect With Us" phone button on the /about page.
-- Stored as dedicated columns (matching the existing about_* / contact_* pattern).

ALTER TABLE "website_configs"
  ADD COLUMN "aboutPhoneLabel" TEXT,
  ADD COLUMN "aboutPhoneNumber" TEXT;
