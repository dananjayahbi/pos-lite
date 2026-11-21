# Expense and cash-flow date ranges

Report date inputs send `YYYY-MM-DD`. `new Date('2026-09-16')` is midnight at the
**start** of that day, so using it as an upper bound excluded everything recorded
later on the chosen end date (ARGUS #394). With To = 16 Sep the expense list
returned only the 8 Sep salary and omitted the 16 Sep misc expense; the cash-flow
statement omitted the 16 Sep expense and four sales, understating net by
Rs 16,847.66. The page defaults To to today, so today's activity was invisible.

## Rule

`parseRangeStart` / `parseRangeEnd` (`src/lib/dates/inclusiveRange.ts`):

| Input                    | Start                     | End                       |
| ------------------------ | ------------------------- | ------------------------- |
| `2026-09-16`             | `2026-09-16T00:00:00.000Z`| `2026-09-16T23:59:59.999Z`|
| full ISO timestamp       | unchanged                 | unchanged                 |
| `Date` object            | unchanged                 | unchanged                 |

Applied to the expense list (`getExpenses`) and the cash-flow statement API, so
both the rows and the totals include the whole selected end day.

Verification: `src/lib/dates/__tests__/inclusiveRange.test.ts` covers date-only
start/end, a record later on the end date, full timestamps and Date passthrough.
