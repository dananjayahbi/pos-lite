# Sales date format (ARGUS #83)

The three sale surfaces formatted dates differently:

| Surface | Before | After |
| --- | --- | --- |
| Sales list | `28 Oct 2026` + `20:45` | `28 Oct 2026` + `Entered 20:45` |
| Detail modal | `28 Oct 2026, 20:45` | `28 Oct 2026, 20:45` |
| Detail page | `Oct 28, 2026, 8:45 PM` | `28 Oct 2026, 20:45` |

`src/lib/format.ts` now owns the ledger formatters:

- `formatShortDate(value)` -> `28 Oct 2026`
- `formatShortTime(value)` -> `20:45`
- `formatShortDateTime(value)` -> `28 Oct 2026, 20:45`

They use `en-GB`, `day: '2-digit'`, `month: 'short'`, and a 24-hour clock; an
invalid or missing value renders `-`. The Sales list, detail modal and detail
page call them directly instead of keeping private formatters.

The modal's totals row now says **Subtotal**, matching the detail page (and the
receipt), instead of `Sub-total`.

Tests: `src/lib/__tests__/format.test.ts`.
