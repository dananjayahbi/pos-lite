# M26-03 — BUG-67: corrupt XLSX upload → unhandled 500 (typed parse failure + dead FAILED/parseError plumbing)

**Severity:** P3-Minor · **Module:** 26 Reconciliation · **QA pin:** `tests/26_courier_reconciliation.spec.ts` H2 · **Depends on:** INF-02

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/reconciliation/import/route.ts:27-38` — `importRemittanceStatement` → `parseRemittanceFile` → `XLSX.read` (`reconciliation-parser.service.ts:77`) throws on malformed workbook bytes; the message isn't a sentinel → `mapDeliveryError` returns null → **500**. Wrong *extension* is correctly 400 (F11 green) — only corrupt-but-accepted files crash.
- The `StatementImport` schema has `status FAILED` + `parseError` columns that app code **never writes** (grep-confirmed zero non-generated hits) — `importRemittanceStatement` only ever writes `PARSED`→`COMPLETED` (`reconciliation.service.ts:119-146`). The failure-recording design exists but is dead.

## Fix approach
1. Wrap the parse stage: catch workbook-parse errors → create/update the `StatementImport` row with `status:'FAILED'`, `parseError: <short message>` → return typed **400 VALIDATION_ERROR** ("Could not parse statement file") so the UI toasts properly and operators get history of failed uploads.
2. Keep the 500 path reserved for genuinely unexpected errors (via INF-02 envelope).
3. Surface FAILED imports in the reconciliation UI list (small addition to the existing imports/statement list component — new row treatment, not a rewrite).

## Files
- `src/app/api/store/reconciliation/import/route.ts`, `reconciliation.service.ts` (FAILED write), reconciliation UI list component.

## Acceptance / gate
- `tests/26` H2 flips: corrupt xlsx → 400 + a FAILED `StatementImport` row with parseError set; valid CSV/XLSX flows unchanged (F9/F10 idempotency green).
