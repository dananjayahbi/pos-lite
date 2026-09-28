# M16-02 — BUG-49: GRN receiving worksheet cannot capture batch number or expiry date (API supports them, UI doesn't)

**Severity:** P2-Major (blocks req 3.10 end-to-end batch/expiry traceability for warehouse users) · **Module:** 16 Purchases/GRN · **QA pin:** `tests/16_purchases_po_grn.spec.ts` (batch/expiry capture) · **Depends on:** M11 (batch service already works), nothing blocking

## Verified source state (2026-09-15) — still holds
- `src/components/suppliers/GoodsReceivingForm.tsx` — the per-line entry model carries only `qty` + `actualCostPrice` (lines 25, 57, 89, 111, 136-159); the `receivedLines` payload it POSTs (148-173) has **no `batchNumber`/`expiryDate` fields**.
- The API/service already accepts both: `receivePOLines` handles batch accumulation (`purchaseOrder.service.ts:296-308`) with `batchNumber`+`expiryDate`, and Module 11 QA proved end-to-end GRN batch capture works **at the API level** — only the UI worksheet is missing the inputs.

## Fix approach
1. Add per-line `batchNumber` (text) + `expiryDate` (date input) to `GoodsReceivingForm`'s line entry state and the `receivedLines` payload — only shown for variants that are batch-tracked (a product/variant flag; if none exists, show always with a note). Keep the modular pattern: extend the existing line-row subcomponent rather than inlining.
2. Wire the values into the existing receive POST body (API already reads them — no API change expected; verify the `[id]/receive` route passes `batchNumber`/`expiryDate` through to the service, which QA confirmed it does).
3. Optional: batch-required indicator per supplier/product config (out of scope; note for REQ if the client wants enforced capture for certain categories).

## Files
- `src/components/suppliers/GoodsReceivingForm.tsx` (+ its line-row component), confirm `receive/route.ts` passthrough.

## Acceptance / gate
- `tests/16` batch/expiry pin flips from "UI can't provide them" to: receive a batch-tracked line with batchNumber+expiryDate via the worksheet → `BatchTracking` row created (qty + expiry), `PURCHASE_RECEIVED` movement carries `batchId`; Module 11 `/inventory/batches` shows it. Non-batch lines unaffected.
