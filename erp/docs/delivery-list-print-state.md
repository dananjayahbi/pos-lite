# Delivery list print actions

ARGUS #274. The Deliveries & Tracking list had no spinner or disabled state for
the row Print and Invoice actions. Invoice failures were only written to the
console, and a double-click could start two print flows.

## Behaviour

- `src/components/delivery/printState.ts` derives a key (`waybill:<id>` or
  `invoice:<id>`) and the button state for each row.
- Starting a print disables every row's Print/Invoice button, so a second
  click cannot open another overlay.
- The active row shows a spinner and `Preparing...` in the clicked button.
- A failure from either action shows an error toast with the API message.
- The spinner stays until the print overlay closes, matching the Orders page
  and the delivery detail.

Tests: `src/components/delivery/__tests__/printState.test.ts`.
