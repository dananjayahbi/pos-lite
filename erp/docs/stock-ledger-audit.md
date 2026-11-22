# Stock ledger audit and repair (ARGUS #198)

## The invariant

`StockMovement` is append-only. Each row records the stock level before and after
its own change, so a variant's history must be one unbroken chain:

```
movement[0].quantityBefore            === 0            (opening balance)
movement[i].quantityBefore            === movement[i-1].quantityAfter
lastMovement.quantityAfter            === ProductVariant.stockQuantity
movement.quantityBefore + quantityDelta === movement.quantityAfter
```

The ledger is the audit trail for every stock change, so any of these failing
means stock was moved by something other than the inventory service.

## Findings (dev database, 2026-11-21)

Read-only audit run: `node --env-file=.env --import tsx scripts/audit-stock-ledger.ts`

| Metric | Result |
| --- | --- |
| Live variants scanned | 23 |
| Movements scanned | 104 |
| Chain breaks | 5 (5 variants) |
| Current mismatches (`stockQuantity` ≠ last `quantityAfter`) | 12 (12 variants) |
| Arithmetic errors (`before + delta ≠ after`) | 0 |
| Unexplained openings (first row starts above 0) | 4 |
| Units a repair would append | +347 / -0 |

The ticket snapshot (250 movements, 7 chain breaks, 12/23 variants mismatched) is
the same defect observed at a different point in time; the counts move as new
sales, voids and seed runs land.

Representative rows:

- `BAI-08-OIL-100ML` — `INITIAL_STOCK 0 → 29` on 19 Aug, then the next row is a
  `SALE 50 → 49` on 15 Nov. The chain break is **+21 units** that appeared with
  no movement row; the current stock (46) still matches the tail, so a repair
  movement cannot fix this one.
- `HIM-00-POW-500G` — one `INITIAL_STOCK 0 → 2` row while the current stock is
  50. The final 48 units have no provenance; a repair appends `+48`.

Root cause: the rows are arithmetically correct, so this is a **missing
movement** problem. Seed/test resets (and older code paths) wrote
`stockQuantity` directly instead of going through `adjustStockInTx`. The
opening-stock path now logs an `INITIAL_STOCK` movement, so new occurrences are
prevented; the historical gaps remain.

Movement coverage in the scanned tenant is `SALE=50`, `VOID_REVERSAL=37`,
`INITIAL_STOCK=17` — there are no `SALE_RETURN` or `STOCK_TAKE_ADJUSTMENT` rows
at all, and every sale-triggered write it does have is present. The gaps
therefore sit in manual/seed stock writes, not in the sale path.

## Audit CLI — `scripts/audit-stock-ledger.ts`

Read only; never writes.

```bash
node --env-file=.env --import tsx scripts/audit-stock-ledger.ts
node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --tenant=<tenantId>
node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --strict        # non-zero exit on findings
node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --json          # machine output
node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --all           # list consistent variants too
```

Per tenant it prints totals, movement-reason coverage, and one compact line per
inconsistent variant (`qty`, `ledger`, `gap`, `moves`, `breaks`, `reasons`)
followed by each chain break and current mismatch. Soft-deleted variants are
excluded (they are not "live" stock).

Comparisons live in `src/lib/services/stockLedgerAudit.core.ts` and are unit
tested in `src/lib/services/__tests__/stockLedgerAudit.core.test.ts`, so the
report and the repair share one definition of "inconsistent".

## Repair CLI — `scripts/repair-stock-ledger.ts`

Dry run by default; `--apply` required to write.

```bash
node --env-file=.env --import tsx scripts/repair-stock-ledger.ts
node --env-file=.env --import tsx scripts/repair-stock-ledger.ts --tenant=<tenantId>
node --env-file=.env --import tsx scripts/repair-stock-ledger.ts --apply
```

For each variant whose current stock differs from the ledger tail it appends
**one** `DATA_ERROR` movement for the delta:

- goes through `adjustStockInTx` (the same path as every other stock change),
  so `quantityBefore`/`quantityAfter`/`quantityDelta` are written by the service;
- the delta is re-read inside the write transaction, so a concurrent sale or
  adjustment is respected and a now-reconciled variant is skipped;
- `actorId` is `null` (SYSTEM). `StockMovement.actorId` is nullable and
  `adjustStockInTx` now accepts `string | null` for this case;
- a `STOCK_LEDGER_REPAIRED` audit row (actorRole `SYSTEM`) records the ledger
  tail, the current stock, the appended delta and the script for every write;
- the movement note states it is a **synthetic correction**, not a record of
  what actually happened.

Variants already consistent are skipped. Chain breaks and arithmetic errors are
reported again after the run because appending a row cannot repair history that
is already wrong in the middle — those need manual review.

### Why existing rows are never rewritten

The ledger is evidence. Updating `quantityBefore`/`quantityAfter` on an old row
would make the audit trail claim a history that never happened, hide the defect
from future audits, and destroy the only record of when the unexplained stock
appeared. Appending an explicit `DATA_ERROR` correction is honest: the ledger
still shows the gap, and additionally now explains the current quantity. Nothing
in either script updates or deletes an existing movement.

## Legacy data

The 12 mismatched variants and 5 broken chains above are left in place for the
operator to decide (see `--apply`). Re-running the audit is the source of truth
after any repair.
