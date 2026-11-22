# Returned sales cannot be voided

A sale that already has a completed return cannot be voided (ARGUS #94). The
return has already restocked the returned units and refunded their value, so a
full void would restore the stock a second time and reverse the entire sale
value in the payment-account ledger — including money that was already paid
back to the customer.

Example: a sale logged `SALE −1`, the return `SALE_RETURN +1`, and a void would
add `VOID_REVERSAL +1`, leaving one extra unit in stock and over-reversing the
ledger.

## Behaviour

`voidSale` counts completed returns for the sale inside the transaction and
calls `assertSaleVoidable` (`src/lib/services/saleVoid.core.ts`):

| Condition                    | Result                                            |
| ---------------------------- | ------------------------------------------------- |
| Sale not `COMPLETED`         | `Error: Only completed sales can be voided` (400) |
| Sale has one or more returns | `409 SALE_HAS_RETURNS`                            |
| Completed sale, no returns   | Void proceeds as before                           |

The POS sale history disables the void action for returned sales and explains
why in the tooltip. Corrections to a returned sale go through the
return/refund flow, which restocks and refunds only what is still outstanding.

## Verification

`src/lib/services/__tests__/saleVoid.core.test.ts` covers the allowed,
returned and non-completed cases.
