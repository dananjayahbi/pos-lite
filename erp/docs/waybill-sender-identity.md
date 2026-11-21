# Waybill sender identity

ARGUS #301. The printed sender was the value saved in the label designer, which
could be stale (`Ayur Wellness Centre` while the business was `Ruhunu Weda
Gedara`). The sender is now resolved from the audited Store Profile, and the
pickup address is printed when configured.

## Source of truth

`src/lib/delivery/sender.ts` resolves the sender from:

- business name: `Tenant.name`
- contact: `Tenant.settings.phoneNumber`
- pickup address: `Tenant.settings.address`

The saved `Tenant.settings.delivery.label` sender values are no longer used for
printing. They remain in the settings blob for compatibility, but cannot
override the business identity.

If name or contact is missing, waybill printing is blocked. A missing pickup
address does not invent data: it is surfaced in the UI warning and the Pickup
address row is omitted from the label until the Store Profile is filled in.

## UI

- The Waybill Design page is read-only for sender details and links to Store
  Profile, so there is no second editable sender that can drift.
- Delivery detail, Deliveries & Tracking, Dispatch Orders and the dispatch
  sheet show an amber warning naming the missing sender fields.
- The label prints a `Pickup address` row only when the Store Profile address
  is present.

## API

`GET /api/store/delivery/label` returns the resolved business sender in
`data` and the same identity in `meta.branding`. The client also resolves from
`meta.branding`, so an older saved template cannot win.

Tests: `src/lib/delivery/__tests__/sender.test.ts` and the updated
`labelTemplateState` tests.
