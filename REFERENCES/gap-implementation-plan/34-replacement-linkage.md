# 34 — Replacement Linkage & Validation

**Module:** M11 — Zero-Value Order Verification
**Severity:** High
**Status:** Not implemented
**Related docs:** [33 — Zero-Value Order Reason](./33-zero-value-order-reason.md), [35 — Zero-Value Audit Dashboard](./35-zero-value-audit-dashboard.md)

## Issue / Current State
The `Sale` model (`erp/prisma/schema.prisma`) already exposes `linkedReturnId` (a reference to a `Return`, used for exchanges), but there is no zero-value replacement flow. There is no field or code path that requires an Original Order ID when a sale is recorded as a replacement, and no validation that the supplied original order actually exists in historical sales.

The sale service (`erp/src/lib/services/sale.service.ts`) and validators (`erp/src/lib/validators/sale.validators.ts`) have no concept of a replacement order reference, so nothing links a free replacement issue back to the order it replaces. A cashier selecting "Product Replacement" as the zero-value reason (per doc 33) currently has no enforced way to point at the original order, and there is no guard against creating a replacement with a fabricated or nonexistent reference.

## Impact
Replacement issues cannot be traced to their originating order, so the owner cannot verify whether a free replacement was legitimate (e.g. a defect/exchange) or an unauthorized give-away. This opens an inventory-loss channel: stock leaves the register for zero revenue with no auditable provenance. Without historical-order validation, typos and fabricated references pass silently, corrupting the replacement trail and any downstream analytics.

## Implementation Plan
### Step 1 — Extend the data model for replacement linkage
Add an optional `zeroValueLinkedOrderRef` field (or reuse/extend the existing linkage field pattern) on the `Sale` model to store the Original Order reference for replacement sales. Keep this distinct from `linkedReturnId` (which ties to a `Return` object) so the two linkage types remain unambiguous. Add a new Prisma migration and regenerate the client under `erp/src/generated`.

### Step 2 — Require and validate the original order
In the sale validators (`erp/src/lib/validators/sale.validators.ts`), when `zeroValueReason` equals `PRODUCT_REPLACEMENT`, require a non-empty original order reference and validate its format. In `erp/src/lib/services/sale.service.ts`, before committing a replacement sale, look up the referenced historical sale (by its order reference/id within the same tenant) and reject creation if the reference does not resolve to an existing, non-voided historical order. Store the resolved linkage on the new sale. Also guard against the original order already having an open replacement if that is the intended policy.

### Step 3 — Wire the linkage into the POS UI
In `erp/src/components/pos/CartPanel.tsx`, when the cashier selects Product Replacement as the zero-value reason (doc 33), show an Original Order ID input. Validate the input against the service before enabling confirmation, and surface a clear inline error when the reference is invalid so the cashier can correct it rather than being silently blocked.

### Step 4 — Persist the linkage for audit
Ensure the resolved replacement linkage and its original reference are recorded in the `AuditLog` on sale completion so the owner dashboard (doc 35) can render the "Linked Previous Order ID" column and verify replacement legitimacy.

## Dependencies
- Doc 33 introduces the `zeroValueReason` field and the Product Replacement reason option that this linkage is driven by.
- Doc 35 renders the linked previous order reference in the audit dashboard.
- Depends on historical `Sale` lookup by order reference within a tenant.

## Files / Areas affected
- `erp/prisma/schema.prisma` (add replacement linkage field; new migration)
- `erp/src/generated` (regenerated Prisma client)
- `erp/src/lib/validators/sale.validators.ts`
- `erp/src/lib/services/sale.service.ts` (historical order lookup/validation)
- `erp/src/components/pos/CartPanel.tsx`
- Existing audit-log write path for sales
