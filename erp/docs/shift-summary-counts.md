# Shift summary counts use the filtered total (ARGUS #116)

`/staff/shifts` used to derive the two summary cards from `data.data`:

```ts
const openCount = shifts.filter((s) => s.status === 'OPEN').length;
const closedCount = shifts.filter((s) => s.status === 'CLOSED').length;
```

`shifts` is one 20-row page, so a tenant with 43 matching shifts saw at most 20
counted and the cards disagreed with `meta.total` and the pagination footer.

## Change

`getShifts()` runs one extra `shift.groupBy({ by: ['status'], where })` with the
same `where` as the list and its `count`, so the counters cover the whole
filtered result. `toShiftStatusCounts()` (`src/lib/shifts/shift-status-counts.ts`)
folds the groups into `{ open, closed }`.

`GET /api/store/shifts` returns them as `meta.statusCounts`; the page prefers
that payload and keeps the page-local calculation only as a fallback for an
older response. Status/cashier/date filters are included in `where`, so filtering
to **Open** correctly reports `closed: 0` — the cards describe what is visible
under the current filters.

## Verification

`src/lib/shifts/__tests__/shift-status-counts.test.ts` covers the 20-of-43 case,
empty payloads, unknown statuses and the shared-empty-constant guard.
