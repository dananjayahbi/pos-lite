# Daily attendance summary cards

The attendance page lets a manager set Present, Absent, Leave, Half Day or
Holiday for a staff member. The summary cards did not include Holiday in every
revision, so they did not add up to the active headcount (ARGUS #354).

## Counting rule

`src/lib/attendance/attendanceSummary.core.ts` counts each staff row exactly
once:

| Status | Card |
| ------ | ---- |
| `PRESENT` | Present |
| `ABSENT` | Absent |
| `INSUFFICIENT` | Absent (also `insufficient` sub-count) |
| `LEAVE` | On Leave / Half Day |
| `HALF_DAY` | On Leave / Half Day |
| `HOLIDAY` | Holiday |
| `OFF` | Off / Scheduled |
| `SCHEDULED` | Off / Scheduled |

`OVERTIME` is a total in minutes, not a headcount card.

`accounted = present + absent + onLeave + halfDay + holiday + off + scheduled`
and `reconcilesToHeadcount(summary)` is true when it equals `total`
(`rows.length`).

`INSUFFICIENT` is included in Absent because payroll treats hours below the
half-day threshold as no-pay, while the separate `insufficient` value is shown
as a note under the card.

## Cards

The page renders six cards:

1. Present
2. Absent (with an "N insufficient hours" note when applicable)
3. On Leave / Half Day
4. Holiday
5. Off / Scheduled
6. Overtime Today

The previous combined `Holiday / Off` card is gone, so a holiday is visible on
its own and the five headcount cards always add up to the active staff count.

## Verification

`src/lib/attendance/__tests__/attendanceSummary.core.test.ts` covers every
status, the Holiday/Off split, the Insufficient subset, overtime summation and
headcount reconciliation (including an empty set).
