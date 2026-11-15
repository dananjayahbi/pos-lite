# Order / shipping invoice design

Feature update #13 — the printable invoice opened from **Orders / Delivery →
Print Invoice** (`/api/store/deliveries/[id]/invoice`, rendered by
`OrderInvoice` in the print overlay).

## 1. A4 only

`printOrderInvoice` injects an `@page` rule with the invoice content:

```css
@page { size: A4 portrait; margin: 10mm; }
```

The invoice body prints at **180 mm** wide (inside A4's 190 mm printable width
after the 10 mm margins). Batch printing (`printOrderInvoices`) puts one invoice
per page with `break-after: page` (last page auto).

The on-screen preview remains 794 px (A4 at 96 dpi).

## 2. Company logo

The header shows the tenant logo from `Tenant.logoUrl` (Settings → Store
Profile), passed through the invoice payload as `logoUrl`. When no logo is
uploaded, a neutral monogram tile with the company initials is rendered instead,
so the header never has an empty logo slot. The logo is **not** part of the
dark banner anymore — see below.

## 3. No unnecessary dark areas

The old invoice used a full-width espresso banner and the app's pearl page
background printed as a large beige block below the content. The redesign:

- header is white with an espresso bottom rule (no filled dark band);
- totals/payment boxes are white with thin borders;
- print CSS forces `html`, `body`, the print-overlay root and `.invoice-a4` to
  `#ffffff`, so nothing but the invoice content prints on the page.

## 4. Line items

The invoice table is populated from, in order:

1. the linked POS sale's `SaleLine` records (`saleId`), or
2. the delivery's own `DeliveryLine` snapshots (website checkout / manual
   deliveries that carry items).

`selectInvoiceLines` in `order-invoice.service.ts` prefers sale lines but falls
back to delivery lines when the linked sale has **no** lines — previously that
combination rendered an empty table while the delivery did have item rows.
Subtotal is derived from whichever source is used, so the totals reconcile with
the table. Deliveries with no item data at all keep the explicit
"No product line items were recorded" row instead of a silently blank table.

## 5. Payment method

The invoice always shows a **Payment** panel:

| Delivery field | Display |
| --- | --- |
| `paymentMethod: COD` | Cash on Delivery (COD) |
| `paymentMethod: CARD` | Card payment (+ `payhereMethod` such as VISA when known) |
| `paymentStatus: PENDING` | COD → "Collect on delivery"; card → "Awaiting payment" |
| `PAID` / `FAILED` / `REFUNDED` | Paid / Payment failed / Refunded |

Fields added to `OrderInvoiceData`: `paymentMethod`, `paymentStatus`,
`paymentDetail`.

## Tests

- `src/lib/services/__tests__/order-invoice.test.ts` — mapper + new
  `selectInvoiceLines` fallback cases.
- `tests/40_invoice_design.spec.ts` — A4 print CSS present, light header,
  logo/monogram, COD payment panel, empty-lines message, and a sale-linked
  delivery whose invoice lists the sale's line items.

## Files

- `src/components/delivery/invoices/OrderInvoice.tsx`
- `src/components/delivery/invoices/printOrderInvoice.tsx`
- `src/lib/services/order-invoice.service.ts`
- `src/types/order-invoice.ts`
