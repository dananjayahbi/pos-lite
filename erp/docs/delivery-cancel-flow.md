# Delivery cancel flow

ARGUS #272. The list opened a confirmation dialog and allowed
`PLACED`, `PENDING_DISPATCH` and `HOLD`, while the detail fired the cancel
immediately and only for `PENDING_DISPATCH`. The detail now uses the same
confirmed dialog, the same status rule and the same optional reason field.

## Rule

`src/components/delivery/cancelDelivery.ts` exports:

- `CANCELLABLE_DELIVERY_STATUSES` - `PLACED`, `PENDING_DISPATCH`, `HOLD`
- `canCancelDelivery(status)` - used by both surfaces
- `cancellableStatusesLabel()` - dialog copy

The service (`cancelDelivery`) already enforces the same three statuses in its
atomic `updateMany` claim, so a forged request for a dispatched or terminal
delivery is rejected server-side.

## UI

`CancelDeliveryDialog` is shared by `DeliveryTable` and `DeliveryDetailPanel`:

- confirmation copy with the order reference
- optional reason (max 500 characters) sent to `POST /deliveries/[id]/cancel`
- destructive confirm button disabled while the request is pending
- no one-click cancel path remains on the detail

Tests: `src/components/delivery/__tests__/cancelDelivery.test.ts`.
