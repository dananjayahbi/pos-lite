# Time clock hour summary

The staff-detail Time Clock tab shows "Hours This Week" and "Hours This Month"
badges. They used to be computed in the browser from the ten records on the
current page, so they changed when paginating and understated the month
(ARGUS #352).

## Server-side aggregation

`GET /api/store/timeclock` now returns a `summary` alongside the page:

```json
{
  "records": [ ... ],
  "total": 120,
  "page": 2,
  "pageSize": 10,
  "totalPages": 12,
  "summary": { "hoursThisWeek": 32.5, "hoursThisMonth": 148.25 }
}
```

`getTimeClockHistory` calls `getTimeClockSummary` in parallel with the page
query. The summary is computed from the full history, not from `records`.

`getTimeClockSummary`:

- resolves Monday 00:00 local for the week and the 1st 00:00 local for the
  month;
- loads every punch from the earlier of those two boundaries (a week can start
  in the previous month);
- sums `punchHours` for records inside each window;
- rounds to two decimals.

`punchHours` uses a closed punch's real duration and caps an open punch at the
tenant's `maxShiftMinutes` (default 16h), matching every other attendance
surface (ARGUS #351).

The pure helpers live in
`src/lib/attendance/timeclockSummary.core.ts`:

- `punchHours(punch, now, maxShiftMinutes)`
- `summarizeTimeClockHours({ records, weekStart, monthStart, now, maxShiftMinutes })`
- `startOfLocalWeek(now)` / `startOfLocalMonth(now)`

The panel no longer keeps local totals or re-sums on page changes; it renders
`data.summary`.

## Verification

`src/lib/attendance/__tests__/timeclockSummary.core.test.ts` covers full-history
summing across more records than one page, month/week boundaries, a week that
starts in the previous month, open-punch capping, negative-duration guarding and
rounding.
