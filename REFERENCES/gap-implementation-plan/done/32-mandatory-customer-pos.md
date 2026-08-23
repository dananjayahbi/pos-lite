# 32 — Mandatory Customer at POS

**Module:** M10 — POS & Payments
**Severity:** High
**Status:** Not implemented
**Related docs:** 31-lankaqr-payment.md

## Issue / Current State
A POS sale can be finalized without any customer information. `Sale.customerId` is nullable, and `createSale` in `erp/src/lib/services/sale.service.ts` treats the customer as optional. The Charge/Pay action in `erp/src/components/pos/CartPanel.tsx` is not gated on a linked customer, and the customer selection surface (`erp/src/components/pos/CustomerSearchDropdown.tsx` or equivalent) allows proceeding without a selection. The sale validator (`erp/src/lib/validators/sale.validators.ts`) does not require customer identity.

## Impact
Sales proceed with no customer record, so customer history, loyalty, returns, warranties, and targeted marketing are incomplete or impossible. Anonymous transactions weaken customer data quality and hurt the business's ability to understand its buyers.

## Implementation Plan
### Step 1 — POS validation gate
Gate the Charge/Pay action in `erp/src/components/pos/CartPanel.tsx` on a linked customer with a name and mobile number. When no customer is selected, block finalization and prompt the user to choose or create one.

### Step 2 — Service/validator enforcement
Enforce the mandatory-customer rule in the sale validator (`erp/src/lib/validators/sale.validators.ts`) and in `erp/src/lib/services/sale.service.ts`, returning a clear validation error when a name/mobile is absent. Optionally make `Sale.customerId` required or add a dedicated walk-in customer record.

### Step 3 — Quick walk-in creation
Add a quick walk-in option that still captures name and phone, either by auto-creating/selecting a walk-in customer profile populated with the entered name and mobile, or by prompting for these two fields inline before finalizing.

## Dependencies
- 31 modifies the same checkout flow; implement together so the payment-method selector and the customer gate behave consistently.

## Files / Areas affected
- `erp/src/components/pos/CartPanel.tsx`, `CustomerSearchDropdown.tsx`.
- `erp/src/lib/services/sale.service.ts`.
- `erp/src/lib/validators/sale.validators.ts`.
- `erp/prisma/schema.prisma` — `Sale.customerId` nullability if tightened.
