# Customer analytics: chart, repeat badges, phone validation

## New vs Returning chart (Issue #8.1)

The chart was blank even though the API returned buckets: each bar used
percentage heights inside an auto-height flex item, so `height: %` resolved to 0.
`NewVsReturningChart` now uses a fixed 160px bar area with per-segment pixel
heights, prints the `new / returning` counts under each bucket, and scrolls
horizontally when a range has many weeks.

API shape (unchanged):

```
newVsReturning: [{ week, label, newCount, returningCount }]
```

`newCount` = customers whose very first completed sale falls in that week;
`returningCount` = customers who had already bought before that week.

## Repeat-buyer metals (Issue #8.2)

Top Customers now shows a metal badge next to the name, driven by the
customer's **lifetime** order count (period counts alone would label a long-term
regular "New"):

| Lifetime completed orders | Badge |
| --- | --- |
| 1 | — (first-time) |
| 2–4 | Bronze |
| 5–9 | Silver |
| 10+ | Gold |

`getRepeatBadge()` / `REPEAT_BADGE_META` live in
`src/lib/services/customer-loyalty.ts` (pure, shared with the existing
New/Repeat/Loyal tier used elsewhere). `GET /api/reports/customer-analytics`
returns `lifetimeOrders` and `repeatBadge` per top customer.

## Phone validation (Issue #8.3)

Every customer write path requires a 10-digit Sri Lankan mobile
(`07XXXXXXXX`, normalized to `+94XXXXXXXXX`):

- CRM create/update: `CreateCustomerSchema` → `zSriLankaPhone` (already).
- POS walk-in capture: `WalkInSchema` → `zSriLankaPhone` (already).
- **CSV import** (new): `CustomerCsvRowSchema`
  (`src/lib/validators/customer-import.validators.ts`). A missing/malformed
  phone is a per-row import error; the row is not created. Existing phone
  numbers are normalized before duplicate detection so `077…` and `+9477…`
  collide correctly.

## Verification

- Unit: `customer-loyalty.test.ts` (badge thresholds),
  `customer-import.validators.test.ts` (10-digit rules, `+94` normalization).
- Live: `GET /api/reports/customer-analytics` returns buckets and
  `repeatBadge: BRONZE` for a 2-order customer; `POST /api/store/customers`
  with `088878787` → 400; CSV import reports the same row as an error and
  imports only the valid 10-digit row.
