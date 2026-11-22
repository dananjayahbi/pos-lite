# Manual stock adjustments always write the audit row and webhook (ARGUS #186)

The single and bulk adjustment routes write the `ProductVariant` increment,
`StockMovement` row and low-stock notifications inside their own transaction.
They previously had a separate audit/webhook path, so a change could miss the
`STOCK_ADJUSTED` audit row and the `stock.adjusted` webhook.

## Contract

`recordManualAdjustmentSideEffects` in `src/lib/services/inventory.service.ts`
remains the only side-effect implementation. It:

- runs only for `MANUAL_ADJUSTMENT_REASONS`; system-owned reasons (sale,
  purchase, manufacturing, stock take, ...) keep their originating flow's audit
  story;
- writes `AUDIT_ACTIONS.STOCK_ADJUSTED` through `createAuditLog`, which keeps its
  documented best-effort behaviour;
- dispatches `stock.adjusted` through `dispatchWebhooks` and logs a dispatch
  failure instead of turning a committed movement into a 500.

ARGUS #186 makes the helper `async` and awaits it from:

- `adjustStock` in the service,
- `POST /api/store/stock-control/adjust`,
- `POST /api/store/stock-control/bulk-adjust` (one call per applied row),
- `bulkAdjustStock` in the service.

Awaiting matters in serverless: the previous fire-and-forget call could be
frozen as soon as the response was returned, so the audit row and webhook were
lost even though the stock change had committed. Transactions and row locks are
unchanged; side effects run only after the transaction resolves.

The payload shape comes from `manualAdjustmentSideEffectSummary` /
`manualAdjustmentSideEffectSummaries` in
`src/lib/services/manualAdjustment.core.ts`, covered by
`src/lib/services/__tests__/manualAdjustment.test.ts`.
