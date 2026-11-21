# Seed purchase orders are consistent

The seed created two demo POs with a total but no `subtotalAmount`, and the
RECEIVED PO incremented stock directly with no `PURCHASE_RECEIVED` movement, so a
fresh install reproduced the broken totals equation and unaccounted receipt
(discovered while fixing ARGUS #232).

The seed now writes subtotal = total (35000 and 40500), zero discount, and one
`PURCHASE_RECEIVED` movement per received line (before/after quantities, PO id
and actor), matching the real receipt path. Existing databases still use the
`repair-purchase-orders.ts` backfill.
