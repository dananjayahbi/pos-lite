# M14-04 — Req 3.11: zero-value "Replacement" requires an order reference today; the **defective-item barcode** input the client asked for does not exist

**Severity:** P2-Major (requirement gap, partially satisfied) · **Module:** 14 POS · **QA ref:** `QA_CLIENT_REQ.md` 3.11 ("Mandatory defective order barcode input if Replacement is chosen") · **Depends on:** nothing

## Verified source state (2026-09-15) — the implementation moved past QA's note; the literal req is still unmet
What exists now (newer than QA's "no barcode field" observation):
- `sale.validators.ts:26-27,64-72` — `zeroValueReason` enum + `zeroValueLinkedOrderRef` (1..64) **required when reason = PRODUCT_REPLACEMENT** (superRefine).
- `sale.service.ts:186-199` — the ref must resolve to an existing non-VOIDED sale in the tenant, else the sale throws.
- `src/app/api/store/sales/validate-replacement/route.ts` — live lookup endpoint (permission `SALE.createSale`) for the POS to verify a reference before submitting.
What's missing: the client asked for a **barcode of the defective item** (scan the physical returning product), not merely a pointer to the original order. There is no defective-barcode field on the sale/zero-value path, and `zeroValueLinkedOrderRef` is free-text (order id/ref), not barcode-validated.

## Fix approach (scope decision + small build)
1. **Confirm intent with client** (roadmap flags it): is an original-order reference sufficient traceability, or must the POS capture the scanned barcode of the defective unit? Recommend BOTH: keep the order-ref requirement, add `defectiveBarcode` (optional string on sale, required when reason=PRODUCT_REPLACEMENT **if** the client confirms) validated against `variants/barcode/[barcode]` (the endpoint with a typed 404 miss-path, QA-verified) and stored on the sale for the audit trail.
2. If adopted: schema field + superRefine, service persistence (new nullable column via migration or store inside existing JSON audit detail — prefer a column for queryability), POS replacement dialog adds a scanner input (keyboard-wedge safe), zero-value report (M34) can then break down by defective SKU.
3. Update req 3.11 checklist wording in `QA_CLIENT_REQ.md` to reflect what shipped (order-ref ✅, barcode per decision).

## Files
- `sale.validators.ts`, `sale.service.ts`, `prisma/schema.prisma` (+migration), POS replacement UI component, `reports/zero-value-sales` (breakdown), tests/14 F-series + tests/34 zero-value.

## Acceptance / gate
- New `tests/14` case: PRODUCT_REPLACEMENT without a valid barcode (when required) → 400; with scanned valid barcode → 201 + barcode visible in the zero-value report row; existing order-ref linkage tests stay green.
