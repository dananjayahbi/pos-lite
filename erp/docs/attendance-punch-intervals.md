# Multiple punches in a day

A staff member can punch in and out several times in one day. The attendance
row shows the earliest clock-in and the latest clock-out, while Worked sums
every interval. A 09:00 - 09:06 row with 4 minutes worked therefore looked
wrong until the hidden punches were explained (ARGUS #356).

## UI

The attendance table has a **Punches** column. It shows the count and opens a
dialog listing every interval:

| Clock In | Clock Out | Duration |
| -------- | --------- | -------- |
| 09:00 | 09:02 | 2m |
| 09:04 | 09:06 | 2m |

The dialog header summarises:

- **Punches** - number of intervals;
- **Worked** - sum of each punch duration;
- **Gaps** - first-to-last span minus worked time.

It also states the first-to-last span and that the difference is time between
punches, not worked time. Open punches show **Active** and use the server's
capped duration (ARGUS #351).

## Pure helper

`src/lib/attendance/punchIntervals.core.ts`:

- `summarizePunchIntervals(records)` returns `intervals`, `workedMinutes`,
  `spanMinutes`, `gapMinutes`, `count` and `hasMultiple`.
- The displayed span always satisfies
  `spanMinutes = workedMinutes + gapMinutes`.
- Malformed timestamps are ignored rather than throwing.
- An open punch derives its end from the capped `durationMinutes`.

## Verification

`src/lib/attendance/__tests__/punchIntervals.core.test.ts` covers three
intervals, the 6-minute span / 4-minute worked / 2-minute gap case, a single
punch, open punches and malformed/empty input.
