# Movement History date filters are inclusive local days (ARGUS #184)

`GET /api/store/stock-control/movements` accepts `from` and `to`. A plain
`YYYY-MM-DD` value used to be parsed as UTC midnight by `parseQueryDate`, so
`from=2026-11-15&to=2026-11-15` compared against two instants at `00:00Z` and
returned zero rows even when movements existed that evening.

## Contract

- `from=YYYY-MM-DD` -> local `00:00:00.000` on that day.
- `to=YYYY-MM-DD` -> local `23:59:59.999` on that day (inclusive).
- Full ISO timestamps (for example `2026-11-15T18:00:00.000Z`) stay exact
  instants, preserving the API behaviour existing callers rely on.
- Missing or blank bounds are open-ended.
- Malformed or calendar-invalid values are still rejected with a 400 by
  `parseQueryDate`; only the boundary construction moved.

This matches the Sales history, appointment calendar and report filters, which
also build local start/end-of-day boundaries.

The pure helper lives in `src/lib/api/inclusive-date-range.ts` and is covered by
`src/lib/api/__tests__/inclusive-date-range.test.ts`. The CSV filename now uses
the caller's date labels instead of `toISOString()`, so it cannot show the
previous UTC day for a local end-of-day.
