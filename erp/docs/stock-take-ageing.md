# Stale stock takes

Two sessions opened on 29 Oct were still unresolved on 20 Nov: one
`IN_PROGRESS` with nothing counted (which blocks every new count) and one
`PENDING_APPROVAL` that could not be resolved from the list (ARGUS #147).

## Behaviour

- A session in `IN_PROGRESS` or `PENDING_APPROVAL` older than **7 days** is shown
  with a **Stale** badge in the list. Ageing is derived only; nothing is
  auto-cancelled or mutated on read.
- An approver (`stock:take:approve`) can now cancel a `PENDING_APPROVAL` session
  as well as an `IN_PROGRESS` one. Cancellation remains discard-only (#206):
  counts are ignored, stock/movements untouched, and the audit records the
  action.
- The create endpoint's "already in progress" conflict now names the session,
  its start date, and whether it is stale, so the operator can find and resolve
  it instead of being stuck.
- The existing Review link (#182) still opens the approval page for a pending
  session; the list now also offers a direct discard for approvers.

Pure helpers: `stockTakeAge.core.ts` (`isStaleStockTake`, `stockTakeAgeDays`) and
the updated `canCancelStockTake` policy.

## Verification

`stockTakeAge.core.test.ts` covers the seven-day boundary, terminal sessions and
invalid dates; `stockTakePolicy.core.test.ts` covers approver-vs-initiator
cancellation for both statuses.
