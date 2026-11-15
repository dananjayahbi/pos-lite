# Courier statement vs system: delivery comparison

The COD reconciliation page (`/delivery/reconciliation`) can now answer a
month-end question the ledger alone could not:

> Does the courier's **Invoice Details** sheet contain exactly the deliveries we
> recorded as delivered, for the right COD and the right charges — and what is
> different if not?

The check is a **dry run**. It never settles a ledger entry, clears a
discrepancy, or writes an import; use **Import Remittance Statement** only
after reviewing the differences.

## Using it

1. On `/delivery/reconciliation`, open **Check courier statement**.
2. Pick a **From** / **To** date range (defaults to the current month).
3. Choose the courier export (`.csv`, `.xlsx`, or `.xls`).
4. Press **Compare statement**.
5. Review the summary and the per-waybill table, then optionally **Export CSV**.

Large statements are capped at 8 MB. The comparison is tenant-scoped and needs
`delivery:recon:view` (the same permission as the page) plus the `delivery`
feature module.

## Dates, auto-correction, and empty results

The date range filters **both** sides. If the workbook has readable `ORDER DATE`
values and **none** of them fall inside the selected range, the comparison runs
over the sheet's own period instead. The UI then says so explicitly and moves
the From/To fields to the period that was actually compared:

> Your selected range 2026-11-01 → 2026-11-30 does not overlap this sheet, so we
> compared the statement's own period instead: 2026-06-15 → 2026-07-13.

The API keeps both ranges (`range` = compared period, `requestedRange` = what
was selected) and sets `rangeAdjusted: true`. Rows outside the compared period
are never silently compared; they are counted in `statementRowsOutsideRange`.

A comparison with nothing on one side is never presented as success:

| Warning                   | When                                              | Severity |
| ------------------------- | ------------------------------------------------- | -------- |
| `NO_STATEMENT_ROWS`       | The workbook has no readable data rows.            | critical |
| `STATEMENT_OUT_OF_RANGE`  | Every readable row is outside the compared period. | critical |
| `NO_SYSTEM_DELIVERIES`    | The period has no DELIVERED orders on our side.    | warning  |

The green "No differences in this range" banner only appears when at least one
delivery actually matched. A sheet whose dates are all outside the range, an
empty sheet, or a period with no deliveries always shows a warning instead.


## What is compared

Our side comes from **DELIVERED** orders whose `deliveredAt` falls inside the
range. The courier's waybill is read from the reconciliation ledger entry, or
from the latest courier shipment when the entry is missing.

The sheet is read by `src/lib/services/reconciliation-parser.service.ts`. For
the Trans Express **Invoice Details** layout, the columns map as:

| Sheet column        | Field          |
| ------------------- | -------------- |
| `WAYBILL ID`        | waybill        |
| `COLLECTED COD`     | collected COD  |
| `DELIVERY CHARGE`   | courier charge |
| `ORDER DATE`        | statement date |
| `STATUS`            | status         |
| `PAYABLE`           | net payable    |

Header matching prefers exact names before partial matches, so `COLLECTED COD`
beats `COD` and `DELIVERY CHARGE` beats `COMMISSION` when both exist.

Rows are matched by normalized waybill first (trimmed, spaces removed,
upper-cased), then by order reference when the sheet has no waybill.

## Difference classifications

| Status                    | Meaning                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `MATCHED`                 | System delivery and sheet agree on COD, charge, and delivered status.   |
| `AMOUNT_MISMATCH`         | Collected COD differs from our COD by more than Rs. 0.01.               |
| `FEE_MISMATCH`            | Sheet delivery charge differs from our shipping fee by > Rs. 0.01.      |
| `STATUS_MISMATCH`         | Sheet does not mark the order delivered (e.g. Pending/Returned).        |
| `MISSING_IN_STATEMENT`    | We delivered the order but the sheet has no row for its waybill.        |
| `MISSING_IN_SYSTEM`       | Sheet row has no delivered order in our system for that period.         |
| `DUPLICATE_IN_STATEMENT`  | The same waybill appears more than once in the sheet.                   |
| `MISSING_WAYBILL`         | Sheet row has neither waybill nor order reference, so it cannot match.  |

Each row carries a plain-language explanation (for example
`Collected 3425.00 vs system COD 3900.00 — short by 475.00.`) plus both sides'
COD, fee, and status, and the row severity. The UI shows only differences by
default and can filter by waybill/order reference.

## Summary numbers

- **System deliveries** and **Statement rows** — the two populations compared.
  The statement card also shows the number of readable rows and how many were
  skipped as outside the range.
- **Matched** / **Differences** — count of tallied rows vs anything else.
- **Missing in statement** and **Not in our system** — counts plus the money
  involved on each side.
- **COD variance** — `statement collected − system COD` (positive means the
  courier reports more than we expected).
- **Other checks** — COD, charge, status, and duplicate counts.
- **Statement rows outside the selected range** — rows skipped by the date
  filter, shown so the operator knows the workbook contained more data.

## Where things live

- Pure comparison engine: `src/lib/services/reconciliation-compare.core.ts`
  (`buildDeliveryComparison`, `parseMoney`, `parseStatementDate`).
- Server loader: `src/lib/services/reconciliation-compare.service.ts`
  (`getDeliveryComparisonReport`).
- API: `POST /api/store/reconciliation/compare` (multipart `file`, `from`, `to`).
- UI: `src/components/delivery/reconciliation/StatementComparison.tsx`.

## Tests

`src/lib/services/__tests__/reconciliation-compare.test.ts` covers matched
rows, COD shortfalls, tolerance, fee/status mismatches, both missing directions,
duplicates, waybill normalization, order-ref fallback, range filtering, result
ordering, statement date coverage, empty-sheet/no-delivery warnings, and the
real Trans Express header mapping.

`tests/26_courier_reconciliation.spec.ts` §X covers the API and UI end to end.
`scripts/qa-reconciliation-seed.ts` seeds deliveries in every state (matched,
COD/charge/status drift, not in statement, no waybill, order-ref fallback,
duplicate, not in system, undelivered) and writes matching `.xlsx` sheets under
`test-artifacts/reconciliation/` for manual browser checks:

```bash
node --env-file=.env --import tsx scripts/qa-reconciliation-seed.ts
node --env-file=.env --import tsx scripts/qa-reconciliation-seed.ts --cleanup
```

