# Stock-take permissions, statuses and cancellation

A stock take is a maker-checker document: the person who counts cannot approve
their own corrections, and counted data is only editable while the count is
open. These rules are shared by the routes, the session page and the list
dialog through `src/lib/services/stockTakePolicy.core.ts` (ARGUS #205/#206).

## Permissions

| Action | Permission | Extra rule |
| ------ | ---------- | ---------- |
| List / read a session | `stock:take` | tenant-scoped |
| Add / edit a counted item | `stock:take` | session must be `IN_PROGRESS` |
| Complete (submit for approval) | `stock:take` | only the initiator |
| Approve / reject | `stock:take:approve` | approver must not be the initiator |
| Cancel | `stock:take` + initiator, or `stock:take:approve` | `IN_PROGRESS` only; discard only |

The item PATCH endpoint rejects a non-`IN_PROGRESS` session with `409 CONFLICT`
instead of letting a `PENDING_APPROVAL`/`APPROVED` row be rewritten. Completion
uses `completeStockTakeSession`, which owns the `PENDING_APPROVAL` transition
and the `STOCK_TAKE_COMPLETED` audit row; the route must not duplicate that
write. The direct session page hides the count inputs, scan box, recount
checkbox and Complete button unless the policy allows them.

## Cancellation is discard-only

Cancelling an in-progress session never changes stock. It sets the session to
`CANCELLED` and writes `STOCK_TAKE_CANCELLED` with the number of counted items
and discrepancies that were discarded. It does not write stock movements or
touch variant quantities.

To apply counted discrepancies, submit the session (`POST .../complete`) and
let a different manager approve it. The cancel endpoint rejects
`action: "apply"` with `422 CANCEL_APPLY_NOT_ALLOWED`, so the old "Apply &
Cancel" shortcut cannot bypass approval or maker-checker.

## Verification

`src/lib/services/__tests__/stockTakePolicy.core.test.ts` covers counting,
completion, cancellation actors and the discard-only disposition.
`tests/13_stock_takes.spec.ts` covers the route behaviour end to end.
