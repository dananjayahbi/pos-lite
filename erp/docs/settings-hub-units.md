# Settings hub lists Units

The sidebar shows **Units** under Settings, but `/settings` listed eight
entries and no Units, with no cross-link either way (ARGUS #484).

## Behaviour

- `SETTINGS_CATALOG` (`src/lib/settings/settings-catalog.ts`) now contains a
  `/settings/units` entry labelled **Units**, placed after Taxes to match the
  sidebar order.
- It is gated by `PERMISSIONS.RAW_MATERIAL.viewRawMaterial`, the same
  permission the Units page and sidebar entry use, so users who cannot open the
  page never see a dead link.
- `SettingsHub` renders the catalog unchanged; no page-specific code was added.

## Verification

`src/lib/settings/__tests__/settings-catalog.test.ts` checks the entry exists,
is permission-gated both ways, and that all hub hrefs stay unique.
