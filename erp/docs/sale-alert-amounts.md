# Sale alerts show the final sale total

Five of 103 sale alerts understated the amount because the stored notification
body was written before the final delivery charge was applied (e.g. CMVS9AY1
showed Rs. 1,641.76 while the sale was Rs. 1,891.76 after a Rs. 250 delivery
charge). The rest matched (ARGUS #53).

## Fix

The notifications API already joins the linked sale for void detection. The list
and popover now use `buildSaleCompletedCopy()` (`sale-alert-copy.ts`) with that
sale's **current** `totalAmount` for `SALE_COMPLETED` alerts that are not voided,
instead of the possibly stale stored body. Voided alerts keep their existing
read-time void copy (#52), so the amount reversed is also current.

The stored body is left untouched (historical text is not rewritten); the UI
renders the authoritative total. The producer route still writes the total it
returns at sale creation.

## Verification

`src/lib/notifications/__tests__/sale-alert-copy.test.ts` covers the completed
copy (delivery-inclusive amount) and consistent formatting.
