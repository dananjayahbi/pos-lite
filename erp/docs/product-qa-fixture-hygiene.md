# QA inventory fixture hygiene (ARGUS #155)

Live/demo data contained `QA Replacement Fixture …` products (5 of 12 live
products), plus fixture stock movements, both stock takes and the only batch.
Nothing is removed automatically.

## Read-only audit (default)

```bash
npx tsx scripts/purge-inventory-fixtures.ts [--tenant=<id>]
```

Prints fixture counts (live vs already soft-deleted), related variants,
movements, stock-take items, batches and units on hand. It modifies nothing.

## Deliberate removal (opt-in)

```bash
npx tsx scripts/purge-inventory-fixtures.ts --tenant=<id> --actor=<userId> --apply
```

`--apply` requires both flags and calls the normal `softDeleteProduct` service,
so the audit log is written and the "no stock on hand" guard still applies
(zero the stock first if a row is skipped). Only names with the documented
prefix match. The append-only stock ledger, stock takes and batches are never
deleted or rewritten; already-deleted fixtures are listed for manual review.
Detection: `src/lib/products/qaFixtureHygiene.core.ts` (unit-tested).
