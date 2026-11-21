# Movement CSV timestamps match the page (ARGUS #200)

The Movement History page formats `createdAt` in local time (for example
`15 Nov 2026, 11:07 pm`), while the CSV wrote `toISOString()`
(`2026-11-15T17:37:00.000Z`). The UTC value can even fall on the previous
calendar day, so filtering and spreadsheet grouping disagreed with the screen.

## Behaviour

`src/lib/stock/movement-timestamp.ts` now owns the format for both surfaces:

- `formatStockMovementTimestamp` produces the page's `en-GB` string.
- `stockMovementDisplayTimeZone` uses the tenant setting
  `settings.timezone` when it is a valid IANA zone, otherwise the server zone,
  falling back to UTC.
- The Movement History page uses the same function with the viewer's local
  zone, so the rendered string format cannot drift.

The CSV `Date` column now carries the local formatted timestamp. A final
`Timestamp (UTC)` column preserves the raw ISO instant for machine-readable
traceability and cross-timezone debugging.

Timezone note: the export uses the tenant's configured timezone; if none is
configured it uses the ERP server's timezone. The UTC column is always UTC.

Tests: `src/lib/stock/__tests__/movement-timestamp.test.ts`.
