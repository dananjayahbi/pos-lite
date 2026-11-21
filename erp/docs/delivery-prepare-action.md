# Prepare for delivery action

ARGUS #275. `PLACED` and `HOLD` deliveries could only be advanced from the
separate Dispatch Orders page. The delivery detail and the Deliveries &
Tracking list now expose Prepare-for-delivery, reusing the existing bulk
prepare route.

## Rule

`src/components/delivery/prepareDelivery.ts` exports
`canPrepareDelivery(status)`:

- true for `PLACED` and `HOLD`
- false for `PENDING_DISPATCH` (already prepared) and every later/final status

The button requires the existing `dispatchDelivery` permission, matching
`POST /api/store/orders/bulk-create-delivery`.

## Server enforcement

No new endpoint was added. `bulkCreateDeliveries` in `order.service.ts` is the
source of truth: it accepts pre-dispatch statuses, rejects `PENDING_DISPATCH`
as already ready, rejects dispatched/final statuses, writes the delivery event
and audits the count. A forged request cannot skip the rule.

## UI

- Detail header shows `Prepare for delivery` for PLACED/HOLD; once prepared it
  is replaced by `Dispatch` after the detail query is invalidated.
- List rows show a compact `Prepare` button with a per-row pending spinner.
- The prepare hook invalidates orders, the delivery list and the delivery
  detail so both surfaces refresh.
- Per-order failures use the existing bulk result summary and toast.

Tests: `src/components/delivery/__tests__/prepareDelivery.test.ts`.
