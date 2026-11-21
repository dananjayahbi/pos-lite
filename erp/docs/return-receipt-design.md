# Return receipt design

Issue #25 — the **Print Return Receipt** action on `/returns` (return-detail modal
and the post-refund success dialog). The receipt is served by
`/api/store/returns/[id]/receipt` and rendered by
`src/lib/return-receipt-renderer.ts`.

## 1. A4 portrait only

The old renderer emitted an 80 mm thermal slip (`@page { size: 80mm auto }`), so
printing it on the store's A4 printer produced a narrow strip lost in a landscape
sheet. The receipt is now an A4 document:

```css
@page { size: A4 portrait; margin: 10mm; }
```

The sheet prints at **180 mm** wide (inside A4's 190 mm printable width after the
10 mm margins). The screen preview is a white 210 mm sheet on a neutral desk; the
`@media print` block drops the desk, shadow and screen padding so only the receipt
prints. A single return fits on one page (the sample return measures ~188 mm of
the 277 mm available content height).

## 2. Brand header

The header mirrors the branded order invoice (`OrderInvoice`):

- tenant logo from `Tenant.logoUrl` (Settings → Store Profile), loaded through
  the receipt route's tenant query;
- a monogram tile with the store initials when no logo is uploaded;
- store name in the display serif, plus address and phone from the store profile.

Because the page is served with a strict CSP, the route allows `img-src` for the
logo (`'self' data: blob: https:`) while keeping everything else locked down.

## 3. Theme colours, no dark bands

The receipt uses the app palette from `globals.css`: espresso `#3A2D28` text and
rules, terracotta `#A48374` accents, sand `#CBAD8D` dividers, linen `#EBE3DB`
table-header fill and mist `#D1C7BD` borders. The page is white with thin rules
instead of a dark banner, matching the invoice redesign.

## 4. Content

- Summary grid: original sale ref, processed by, authorized by, refund method,
  restock status, item/line counts, return reason.
- Line table: product, variant, qty, unit price, line refund and per-line restock
  pill. The table header repeats on page breaks and rows avoid splitting.
- Totals: refund-method explanation, **Goods refunded**, **Tax refunded**
  (including a genuine 0.00 when the return recorded zero tax), **Original sale
  total**, **Not refunded (original − refund)** when the refund is smaller (for
  example a partial return or the non-refundable delivery charge), and **Total
  Refund**.
- Signatures: customer and authorizing manager.
- Footer: store receipt footer, powered-by line and print timestamp.

### Refund-method copy (ARGUS #101)

- `CASH` — “Cash was handed back to the customer at the counter.”
- `CARD_REVERSAL` — names the tender actually collected from the sale's payment
  legs: “original card payment channel”, “original LankaQR payment channel” or
  “original card/LankaQR payment channel”. It never claims a card when the sale
  was QR-only (`returnTender.core` enforces the same rule server-side).
- `STORE_CREDIT` — “The refund has been added to the customer's store-credit
  balance and can be used on a future purchase.” There is no separate credit
  note or expiry in the system, so the receipt does not promise one.
- `EXCHANGE` — “The returned items were exchanged for other items in store.”

The receipt route adds the original sale's payment legs to the return payload
(tenant-scoped through the sale relation) solely to resolve that tender label.

All tenant and return text is HTML-escaped; the only script is the auto-print
call. The print buttons open the receipt URL in a new tab (the return-detail modal
previously called `window.print()` and printed the on-screen modal).

## Tests

- `src/lib/__tests__/return-receipt-renderer.test.ts` — A4 `@page` rule and
  180 mm width, logo vs monogram, store/return metadata, line items and totals,
  refund-method copy, restock states, empty state, escaping (including logo URL)
  and the auto-print hook.

## Files

- `src/lib/return-receipt-renderer.ts`
- `src/app/api/store/returns/[id]/receipt/route.ts`
- `src/components/pos/ReturnDetailModal.tsx`
- `src/components/pos/ReturnReceiptDialog.tsx` (unchanged URL, new layout)
