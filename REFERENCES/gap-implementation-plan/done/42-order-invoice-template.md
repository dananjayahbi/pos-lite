# 42 — Order / Shipping Invoice Template

**Module:** M13 — Invoice & Label Printing
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [07 — Online Payment Gateway](./07-online-payment-gateway.md), [08 — Public Order Tracking Portal](./08-public-order-tracking-portal.md)

## Issue / Current State
A shipping label implementation exists: `ShippingLabel.tsx` at `erp/src/components/delivery/labels/ShippingLabel.tsx` renders a brand header, enlarged customer/recipient information, and dual barcodes, and there is a custom label designer under `erp/src/app/(store)/delivery/label/`. However, there is **no printable order or shipping INVOICE template**. When an order is shipped, staff cannot print a customer-facing invoice that lists the line items, totals, and customer/order information.

## Impact
Customers receiving delivered orders get no itemized invoice, which is a professionalism and compliance gap, and staff have no printable document to attach to a parcel or hand to a customer. The existing label/branding assets and designer pattern are available but unused for invoices, so the work to produce a branded, consistent invoice is more cost than it needs to be.

## Implementation Plan
### Step 1 — Create a printable invoice template component
Build a new printable invoice component (for example `OrderInvoice.tsx` under `erp/src/components/delivery/labels/` or a dedicated `invoices/` folder) that reuses the same branding approach as `ShippingLabel.tsx`: brand header/logo, tenant/store details, and a clean layout. The template renders order information (order reference, date, customer/shipping address, phone), a line-item table (SKU, description, quantity, unit price, line total), and totals (subtotal, discounts, tax, shipping fee, grand total, and any COD amount). Keep it print-ready (print CSS, page sizing) consistent with the existing label printing setup.

### Step 2 — Add an invoice print endpoint
Add an API route (for example under `erp/src/app/api/delivery/` or the orders area) that returns the invoice data for a given order/delivery (fetching the sale lines, customer, address, shipping fee, and totals) so the printable view can be rendered server-side or populated on demand. Follow the existing delivery/order data-access patterns and the permission gating used by related delivery routes.

### Step 3 — Trigger from order and delivery screens
Add a "Print Invoice" action to the relevant order and delivery UI screens (the delivery detail/label flows) that opens or downloads the printable invoice, in the same way the label designer is triggered. Ensure the action respects the appropriate permission (e.g. the delivery/label permissions or an order-view permission).

### Step 4 — Reuse the designer/branding approach
Where practical, extend the custom label designer (`erp/src/app/(store)/delivery/label/`) or the shared branding helpers so the invoice and label share consistent store branding (logo, colors, fonts) without duplicating layout logic. This keeps visual output coherent across labels and invoices.

## Dependencies
- Reuses the branding/designer approach already established by `ShippingLabel.tsx` and the label designer.
- Depends on sale-line, customer, shipping-address, and shipping-fee data exposed by existing delivery/order services.
- Doc 46 defines the permission-gating pattern for any new API route.

## Files / Areas affected
- `erp/src/components/delivery/` (new invoice template, e.g. under `labels/`)
- `erp/src/app/api/` (new invoice print endpoint)
- Order/delivery screens that will host the "Print Invoice" trigger
- Possibly `erp/src/app/(store)/delivery/label/` for shared branding reuse
