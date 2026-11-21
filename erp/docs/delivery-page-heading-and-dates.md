# Deliveries page heading and shared date format

`/delivery` opened straight into the status filter and Create button with no
page title, and its table, timeline and "last synced" label used en-US
month-first, 12-hour dates (`Nov 15, 09:49 PM`) while the rest of the ERP uses
en-GB (ARGUS #276).

## Behaviour

- The page now has a **Deliveries & Tracking** heading and a one-line
  description above the toolbar, matching other store pages.
- The delivery table's dispatched date, the status timeline and the shipment
  "Last synced" line all use `formatShortDateTime()` from `@/lib/format`
  (`15 Nov 2026, 21:49`).
- Recovery attempt timestamps on the detail page use the same helper, so a
  single delivery never mixes date conventions.

## Verification

UI-only change. `npx tsc --noEmit` plus the existing delivery component tests
(`printState`, `deliveryLineItems`, `shipmentStatusSummary`) were run.
