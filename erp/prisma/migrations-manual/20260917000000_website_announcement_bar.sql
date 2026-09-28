-- ============================================================================
-- M29-03 (req 3.4) — site-wide announcement top-bar for the customer website.
--
--   WebsiteConfig.announcementBar : Json @default("{}")
--       shape: { text?: string, link?: string, isActive?: boolean }
--
-- Why JSONB and not dedicated columns: the payload is one nested object edited
-- as a unit by the ERP settings form, which matches the `socialLinks` /
-- `appointments` precedent on this same table (the older `aboutPhone*` fields
-- used TEXT columns because they are flat scalars).
--
-- Default `{}` (NOT `{"isActive":true}`) is deliberate: an existing config with
-- no announcement stored must keep rendering byte-identically. The storefront
-- treats "no text" / "isActive !== true" as inactive and sets
-- `--announcement-bar-height: 0px`.
--
-- The validator (`WebsiteAnnouncementBarSchema`) is `.optional()` inside
-- `WebsiteConfigSchema`, so a partial PUT that omits the key leaves the stored
-- value untouched.
--
-- NOTE: the repo's active dev workflow is `prisma db push` / `prisma generate`.
-- Both are intentionally NOT run by this change (other agents share the DB), so
-- this file is the migration deliverable. Apply against a live DB with
--   node scripts/apply-sql-migration.mjs prisma/migrations-manual/<this file>
-- and then run `prisma generate` so the typed client knows the field.
-- ============================================================================

ALTER TABLE "website_configs"
  ADD COLUMN IF NOT EXISTS "announcementBar" JSONB NOT NULL DEFAULT '{}';