# Reconciliation: Reset button and manual-verification fixtures

Companion to [delivery-statement-comparison.md](./delivery-statement-comparison.md).
That document explains the comparison itself; this one covers the **Reset**
action added to the page and the demo data + workbook used to verify the
comparison by hand.

## Reset

`/delivery/reconciliation` → **Check courier statement** now has a **Reset**
button beside **Compare statement**.

| State | Behaviour |
| --- | --- |
| Nothing selected or compared | Disabled. |
| A file is chosen, an error is shown, or a report exists | Enabled. |
| While a comparison is running | Disabled. |

Pressing it:

- removes the summary cards, warning banners, table and error message;
- empties the file picker so the same file can be selected again;
- clears the row filter and switches **Only show differences** back on;
- **keeps the From/To dates**, because the usual workflow is to correct one
  sheet and re-run the same period.

Reset is client-side only: no API call, no ledger write, no settlement. It only
clears what the previous upload produced.

The implementation is `handleReset` in
`src/components/delivery/reconciliation/StatementComparison.tsx`.

## Manual-verification fixtures

`scripts/reconciliation-demo-seed.ts` creates one delivery per comparison
outcome and writes a matching workbook the operator can upload:

```
REFERENCES/reconciliation-demo-statement.xlsx
```

```bash
cd erp
node --env-file=.env --import tsx scripts/reconciliation-demo-seed.ts
node --env-file=.env --import tsx scripts/reconciliation-demo-seed.ts --cleanup
# multiple tenants in the database: pass --tenant <slug>
```

The seed is idempotent: re-running it first deletes the previous `RECON-DEMO-`
deliveries. `--cleanup` removes exactly those records (and their dependent
shipment/ledger rows) without touching anything else. The workbook is left on
disk so it can be reused.

Fixture dates fall in the **current month**, so the page's default range covers
them immediately. One statement row is dated last month to exercise the
`statementRowsOutsideRange` counter.

### What to expect after uploading the workbook

| Scenario | Expected result |
| --- | --- |
| `BA910001` | Matched |
| `BA910002` | COD mismatch — collected 3,425 vs system 3,900 (short 475) |
| `BA910003` | Charge mismatch — sheet 475 vs system shipping fee 400 (+75) |
| `BA910004` | Status mismatch — sheet says Pending |
| `BA910005` | Missing in statement (no sheet row) |
| `RECON-DEMO-ORDER-FALLBACK` | Matched via ORDER NO (system has no waybill) |
| `BA910006` | Matched + duplicate-row warning (waybill appears twice) |
| `RECON-DEMO-NO-WAYBILL` | Missing in statement |
| `BA910007` / `UNKNOWN-DEMO-ORDER` | Not in our system (sheet only) |
| Blank waybill + blank ORDER NO row | No waybill — cannot be matched |
| `BA910008` (last month) | Counted as outside range, not compared |
| `RECON-DEMO-PLACED`, `RECON-DEMO-DISPATCHED` | Never appear (not delivered) |

Expected summary cards: **8** system deliveries, **7** canonical statement rows
(10 readable rows, 1 outside range), **3** matched, **8** differences, COD
variance **−2,175.00**.

The workbook's second sheet, *Expected results*, repeats this table for offline
checking. The comparison parser reads only the first sheet, so the guide has no
effect on the result.

### Suggested manual run

1. Open `/delivery/reconciliation`.
2. Leave the default (current-month) range.
3. Upload `REFERENCES/reconciliation-demo-statement.xlsx`.
4. Press **Compare statement** and check the summary and row statuses against
   the table above.
5. Press **Reset**: the report disappears, the file picker is empty, and the
   dates stay put.
6. Optionally re-upload the same sheet and compare again.
7. When finished, run the seed with `--cleanup` to remove the demo deliveries.

## Tests

| Test | Covers |
| --- | --- |
| `tests/26_courier_reconciliation.spec.ts` → `X8` | Reset is disabled initially, clears report/file/filters, keeps dates, and allows a second comparison without reload. |
| `tests/26_courier_reconciliation.spec.ts` → `X1`–`X7` | Existing comparison behaviour (matching, warnings, range auto-correction, permissions). |
