# Orders & delivery detail: action buttons

Implements Issue #23 for `/orders` and `/delivery/[deliveryId]`.

## 1. Loading states

Every action that waits on work now shows a spinner and an `aria-busy` state,
and disables itself (and overlapping actions) until it finishes.

| Page | Button | Pending source | Pending UI |
| --- | --- | --- | --- |
| `/orders` | Row **Waybill** | waybill print overlay session | spinner + "Preparing…" |
| `/orders` | Row **Invoice** | invoice fetch + print session | spinner + "Printing…" |
| `/orders` | Bulk **Prepare for delivery** | `useBulkCreateDelivery` mutation | spinner + "Preparing…" |
| `/orders` | Bulk **Waybills** | bulk print session | spinner + "Preparing waybills…" |
| `/orders` | Bulk **Print invoices** | invoice fetches + print session | spinner + "Printing invoices…" |
| `/orders` | **Apply** in Change status | `useBulkStatusChange` mutation | spinner + "Applying…" (dialog stays open) |
| `/delivery/[id]` | **Back** | route transition (`useTransition`) | spinner + disabled |
| `/delivery/[id]` | **Waybill** | print overlay session | spinner + "Preparing waybill…" |
| `/delivery/[id]` | **Print Invoice** | invoice fetch + print session | spinner + "Preparing invoice…" |
| `/delivery/[id]` | Dispatch sheet **Waybill** | print overlay session | spinner + "Preparing waybill…" |
| `/delivery/[id]` | Dispatch sheet **Dispatch** | `useDispatchDelivery` mutation | spinner + "Dispatching…" |
| `/delivery/[id]` | **Track** / **Cancel Delivery** | existing hooks | spinner added |

`renderPrintOverlay` tears its overlay down on `afterprint` (or after the
existing 5 s fallback). Buttons that need a pending state call the print helper
first and then `waitForPrintOverlayToClose()` from `src/lib/print-session.ts`,
which polls for the overlay element to disappear. That keeps the spinner visible
for the whole print session without changing the fire-and-forget print API used
by the delivery list, preview, and invoice callers.

Bulk mutations clear the selection in `onSuccess` (not before), so the action
bar and its spinner remain visible while the request is in flight.

## 2. "Print" → "Waybill"

- `/orders` row action: **Print** → **Waybill**.
- `/orders` bulk action: **Print labels** → **Waybills**.
- `/delivery/[id]` header: **Print Label** → **Waybill**.
- Dispatch sheet: **Print Label** → **Waybill**.
- ("Print Invoice" keeps its name because it prints the invoice, not the
  waybill.)

## 3. Header spacing on the delivery detail page

The three header actions used to be direct children of a `justify-between`
container, so `Waybill`, `Print Invoice`, and `Dispatch` were spread across the
full width. They are now wrapped in one `flex flex-wrap items-center gap-2`
group aligned to the right, giving a consistent 8 px gap; the title/back group
owns the left side. The header now also wraps on narrow viewports.

Regression: `tests/24_delivery_courier.spec.ts` A24 measures the rendered
boxes and fails if any adjacent gap is ≥ 16 px or the buttons are not on the
same row.

## Tests

`tests/38_orders_delivery_buttons.spec.ts`:

- **38.1** — `/orders`: "Print" is gone, row/bulk actions read Waybill(s), and
  clicking Waybill sets `aria-busy` with a visible spinner.
- **38.2** — delivery header: Waybill rename, three actions on one row with a
  small gap, Waybill spinner while printing.
- **38.3** — Print Invoice spinner while the invoice API is deliberately slowed.
- **38.4** — Dispatch sheet: Waybill label and Dispatch spinner while the
  dispatch API is slowed.

## Files

- `src/app/(store)/orders/OrdersPageClient.tsx`
- `src/components/orders/OrdersTable.tsx`
- `src/components/orders/BulkActionBar.tsx`
- `src/components/orders/BulkStatusDialog.tsx`
- `src/app/(store)/delivery/[deliveryId]/DeliveryDetailPageClient.tsx`
- `src/components/delivery/DeliveryDetailPanel.tsx`
- `src/components/delivery/DispatchSheet.tsx`
- `src/lib/print-overlay.ts` (unchanged contract), `src/lib/print-session.ts`
  (new overlay-close helper)
- `src/components/delivery/labels/ShippingLabel.tsx`,
  `src/components/delivery/invoices/printOrderInvoice.tsx` (callers only)
