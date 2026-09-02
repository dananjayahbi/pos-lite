-- Enable the appointments and delivery feature modules by default so tenants
-- created before this migration (which stored `settings.enabledModules` without
-- them) are not silently redirected to /dashboard when hitting /appointments.
--
-- This is idempotent: it only appends a module if it is not already present,
-- using jsonb array operations so no module is duplicated.
--
-- The `enabledModules` array lives inside the Tenant.settings JSON column.

UPDATE "tenants"
SET "settings" = jsonb_set(
  COALESCE("settings", '{}'::jsonb),
  '{enabledModules}',
  (
    SELECT COALESCE(
      jsonb_agg(DISTINCT elem),
      '[]'::jsonb
    )
    FROM (
      SELECT elem
      FROM jsonb_array_elements_text(
        COALESCE("settings"->'enabledModules', '[]'::jsonb)
      ) AS elem
      UNION ALL
      SELECT 'appointments'::text
      UNION ALL
      SELECT 'delivery'::text
    ) AS modules(elem)
  )::jsonb
)
WHERE "deletedAt" IS NULL;
