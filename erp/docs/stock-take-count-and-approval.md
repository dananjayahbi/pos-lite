# Stock-take counts and maker-checker (ARGUS #187 / BUG-42, BUG-43)

Stock takes are integer inventory control and a maker-checker document. Two
control defects are pinned here so they cannot regress.

## Counted quantity is a non-negative integer (BUG-42)

`StockTakeItemUpdateSchema` (`src/lib/validators/stock-take.validators.ts`)
already rejects a negative, fractional, NaN or string `countedQuantity` with
`400 VALIDATION_ERROR`, and `updateStockTakeItem` repeats the `< 0` guard in the
service.

ARGUS #187 adds a defensive layer for rows that predate the validator or were
written outside the PATCH route:

- `isCountedQuantityValid` and `invalidCountedQuantityRows` in
  `src/lib/services/stockTakePolicy.core.ts`.
- `completeStockTakeSession` refuses to submit a session holding an invalid
  count.
- `approveStockTake` refuses to approve one.
- Both routes return `400 INVALID_COUNTED_QUANTITY` with the offending
  variant ids instead of a generic 500 or a negative stock correction.

## The initiator cannot approve their own session (BUG-43)

`canApproveStockTake` encodes the rule: the approver needs `stock:take:approve`,
the session must be `PENDING_APPROVAL`, and the approver must not be
`initiatedById`. There is no deliberate override in the role matrix or docs; an
OWNER who counted must ask a different approver, or cancel and restart.

The rule is enforced in two places:

- the approve route returns `403 FORBIDDEN` with
  "You cannot approve a stock take you initiated";
- `approveStockTake` repeats the check, so a direct service caller cannot bypass
  it.

## Route argument order

While wiring the shared policy helper, the approve route was still calling
`approveStockTake(tenantId, sessionId, actorId)` while the service signature is
`(sessionId, tenantId, actorId)`. Because both are strings, TypeScript could not
catch it and every approval failed as "session not found". The call now matches
the service contract.

## Verification

`src/lib/services/__tests__/stockTakePolicy.core.test.ts` covers the approve
policy and the counted-quantity predicate. `tests/13_stock_takes.spec.ts` covers
the P2 negative-count and F6 self-approval routes end to end.
