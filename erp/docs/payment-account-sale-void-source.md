# Sale Void / Reversal ledger source (ARGUS #430)

The payment ledger has one `SALE_REFUND` enum value for three different events:

- a return refund (`sourceId` = return id);
- a cancelled-return reversal (`sourceId` starts with `return-cancel:`);
- a void/full-sale reversal (`sourceId` = sale id).

Grouping by the enum labelled 59 void reversals as "Sale Refund". Selecting the
Sale Refund filter therefore returned the void population instead of actual
return refunds.

## Rule

`classifyLedgerSource` in `src/lib/services/paymentAccountLedger.core.ts`
derives a display/filter kind from the originating document id:

- `SALE_REFUND` + sourceId matching a sale -> **Sale Void / Reversal**;
- any other `SALE_REFUND` (return, cancelled return, legacy null) -> **Sale
  Refund**;
- all other sources pass through unchanged.

The account book and tenant ledger APIs resolve the relevant sale/return ids
within the same filter window and return `ledgerKind` on each row. The UI labels
`ledgerKind ?? source`.

Filters now match the labels:

- `SALE_VOID` queries SALE_REFUND rows whose sourceId is a sale;
- `SALE_REFUND` queries SALE_REFUND rows NOT tied to a sale (so it excludes
  every void reversal);
- other sources keep exact-source matching.

This reuses the same document-id classification as the cash-flow ledger bridge,
without a schema or enum migration.

## Verification

`paymentAccountLedger.core.test.ts` covers void vs return classification, the
cancelled-return prefix, pass-through sources, and both derived filters.

## Residual

`SALE_VOID` is an API/display pseudo-source, not a database enum value. Any
future integration writing PaymentAccountEntry rows must keep the
`sourceId = sale id` convention for voids.
