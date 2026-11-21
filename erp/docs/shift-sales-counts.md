# Shift sales counts (ARGUS #110)

## Problem

The shifts list rendered `shift._count.sales` under a column labelled **Sales**.
Prisma's relation count has no status filter, so it included `OPEN` (held) and
`VOIDED` rows. An open shift showed 56 "sales" while its closure/Z-report
counted the 10 `COMPLETED` sales (10 completed + 46 voided). A closed shift
showed 11 vs the report's 1.

## Definition

One definition now feeds the list, closures and reports:

| Label | Meaning |
| --- | --- |
| **Transactions** | every `Sale` row attached to the shift (`OPEN` + `COMPLETED` + `VOIDED`) |
| **Completed sales** | `COMPLETED` rows only — the figure `closeShift` and `buildZReportData` already report |
| **`N voided` / `N held`** | muted detail beside the completed count, so the transaction total is explainable |

Voided rows are never labelled "Sales". `OPEN` rows are **held**, not completed;
closing a shift voids lingering `OPEN` rows before aggregating `COMPLETED`, so a
closed shift's `completed + voided` equals its transaction total.

The same definition applies to open and closed rows because both come from
`getShifts`; the Z-report and shift detail already said "Completed sales" and are
unchanged.

## Implementation

`src/lib/shifts/shift-sales-count.ts` (pure, unit tested):

```ts
summarizeShiftSales(statuses) -> { completed, voided, held, total }
groupShiftSalesByShift(rows)   -> Map<shiftId, summary>
shiftSalesDetailLabel(summary) -> "46 voided · 2 held" | ""
```

`getShifts` now runs one tenant-scoped `sale.groupBy({ by: ['shiftId','status'] })`
for the page's shifts (instead of the unfiltered `_count.sales`) and returns
`salesCounts` per row. The list component renders the two columns from that.
