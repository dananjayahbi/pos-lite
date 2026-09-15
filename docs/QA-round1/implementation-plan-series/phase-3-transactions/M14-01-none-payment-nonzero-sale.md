# M14-01 — BUG-44: `NONE` payment method accepts a non-zero sale (completed with no payment leg)

**Severity:** P2-Major (financially incomplete sales; bypasses tender reconciliation) · **Module:** 14 POS · **QA pin:** `tests/14_pos_billing.spec.ts` F9 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds (with newer zero-value machinery to build on)
- `src/lib/validators/sale.validators.ts` `CreateSaleSchema` (line 15): `paymentMethod: z.nativeEnum(PaymentMethod)` — superRefine constrains CASH (cashReceived>0) and SPLIT (cardAmount+cashReceived) but says **nothing about NONE**.
- `src/lib/services/sale.service.ts:178-203`: `isZeroValue = totalAmount.lte(0)`; zeroValueReason required only when zero; payment rows created only for CASH/CARD/LANKAQR/SPLIT (247-292) — **NONE creates no Payment** (line 203 even forces `effectivePaymentMethod='NONE'` for zero totals).
- Repro stands: taxable variant + `cartDiscountAmount == retailPrice` (tax remains) + `paymentMethod:"NONE"` → 201 COMPLETED, positive `totalAmount`, no tender.
- Note: the service now validates `PRODUCT_REPLACEMENT` linkage (original order must exist, 187-199) — the reason-code machinery QA asked for exists; the hole is that NONE can be reached WITHOUT that machinery (non-zero total).

## Fix approach
1. **Validator:** in `CreateSaleSchema.superRefine`, forbid `NONE` outright at the API input level — zero-value sales should be expressed by the total being 0 (+ reason), with the service coercing `effectivePaymentMethod='NONE'` internally (line 203 already does this). A client sending `NONE` with a non-zero total → 400 VALIDATION_ERROR ("A non-zero sale requires CASH/CARD/SPLIT/LANKAQR").
2. **Service defense-in-depth:** if `input.paymentMethod === 'NONE' && !isZeroValue` → throw typed error (covers internal callers).
3. POS UI: confirm the tender selector can't submit NONE for non-zero totals (it presumably only offers NONE on the zero-value path — verify during implementation).

## Files
- `src/lib/validators/sale.validators.ts`, `src/lib/services/sale.service.ts`, POS payment modal if it exposes NONE.

## Acceptance / gate
- `tests/14` F9 flips: NONE + positive total → 400; genuine zero-total sale with reason still 201 with NONE recorded. Split-tender reconciliation tests stay green.
