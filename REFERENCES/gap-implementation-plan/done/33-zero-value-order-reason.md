# 33 — Zero-Value Order Reason Selection

**Module:** M11 — Zero-Value Order Verification
**Severity:** High
**Status:** Not implemented
**Related docs:** [34 — Replacement Linkage](./34-replacement-linkage.md), [35 — Zero-Value Audit Dashboard](./35-zero-value-audit-dashboard.md)

## Issue / Current State
Zero-value sales are entirely blocked at the point of sale. In `erp/src/components/pos/CartPanel.tsx`, the Charge/Pay button is rendered `disabled` whenever the computed `amountDue` is less than or equal to zero (`amountDue ≤ 0`). There is no reason-selection dropdown and no code path that permits completing a sale whose total is zero.

The `Sale` Prisma model (`erp/prisma/schema.prisma`) has no field to record why a sale is zero-valued. The sale validators in `erp/src/lib/validators/sale.validators.ts` and the create logic in `erp/src/lib/services/sale.service.ts` likewise contain no handling for zero-value totals, so even if the UI were unblocked, a zero-total sale would not be captured with any justification. This means legitimate zero-value transactions (e.g. bank-transferred advance already paid, a complimentary gift, or a product replacement) cannot be recorded through the system at all.

## Impact
Cashiers are forced to fabricate a nominal amount or record the transaction outside the system, or they cannot complete a legitimate no-payment sale at all. This produces inaccurate sales figures, an unverifiable trail for free/replacement items, and a gap that can be abused to pass inventory out of the store without a recorded justification. Without a mandatory reason the owner has no way to audit why stock left the register with zero revenue.

## Implementation Plan
### Step 1 — Add data model for the reason
Add a `zeroValueReason` field to the `Sale` model in `erp/prisma/schema.prisma`. Model it either as a nullable String storing one of a fixed set of reason keys, or as a dedicated Prisma enum (for example with values `BANK_PAYMENT`, `PRODUCT_REPLACEMENT`, `COMPLIMENTARY_GIFT`). Prefer the enum for type safety and consistency with existing enums such as `PaymentLegMethod`. Also add an optional `zeroValueLinkedOrderRef` (see doc 34) that holds the referencing original order for replacement cases. Create a new Prisma migration and regenerate the generated client under `erp/src/generated`.

### Step 2 — Enforce the reason in the sale service and validators
In `erp/src/lib/validators/sale.validators.ts`, add validation so that whenever the computed total is zero the payload must include a valid `zeroValueReason`. Reject the sale if the reason is missing or not in the allowed set. In `erp/src/lib/services/sale.service.ts`, require and persist the reason inside the `createSale` transaction, and treat the zero-value flag as an invariant of the completed sale (e.g. `zeroValueReason` must be null for non-zero totals and present for zero totals). Keep all monetary bookkeeping (subtotal, tax, total) consistent with a true zero-value sale.

### Step 3 — Unblock and instrument the POS UI
In `erp/src/components/pos/CartPanel.tsx`, change the Charge/Pay button logic so it is no longer unconditionally disabled at zero `amountDue`. When `amountDue` is zero (or negative due to discount), instead require the cashier to select a reason from a dropdown populated with the allowed reasons (Bank Payment / Product Replacement / Complimentary Gift). For the Product Replacement choice, surface the original-order input described in doc 34. Disable confirmation until a valid reason (and, when applicable, a valid reference) is supplied.

### Step 4 — Record to audit and notifications
Ensure completing a zero-value sale writes an `AuditLog` entry (entityType `Sale`, action e.g. `SALE_ZERO_VALUE_COMPLETED`) capturing the cashier, the reason, and any linked order reference, so the transaction is fully traceable and usable by the dashboard in doc 35.

## Dependencies
- Doc 34 defines the required original-order validation that the Product Replacement reason depends on.
- Doc 35 consumes the persisted reason and linked reference for the owner audit dashboard.
- Depends on the existing `Sale`/`Shift` models, the sale validators, and the POS `CartPanel` component.

## Files / Areas affected
- `erp/prisma/schema.prisma` (add `zeroValueReason` and any related fields; new migration)
- `erp/src/generated` (regenerated Prisma client)
- `erp/src/lib/validators/sale.validators.ts`
- `erp/src/lib/services/sale.service.ts`
- `erp/src/components/pos/CartPanel.tsx`
- Existing audit-log write path for sales
