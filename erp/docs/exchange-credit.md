# Exchange credit funds the replacement sale

An **EXCHANGE** return refunds the returned goods as credit toward a
replacement sale, and that sale is linked back to the return (ARGUS #93).
Previously the wizard only wrote the credit into the browser cart store; no
component read it and no sale carried `linkedReturnId`, so the customer got
nothing.

## Model

| Concept            | Where it lives                                    |
| ------------------ | ------------------------------------------------- |
| Returned value     | `Return.refundAmount` (refund method `EXCHANGE`)  |
| Credit applied     | `Payment` leg with `method = EXCHANGE_CREDIT`     |
| Link to the return | `Sale.linkedReturnId` → `Return.linkedSales`      |
| Unused remainder   | `Customer.creditBalance` (issued as store credit) |

A `STORE_CREDIT` return is different: it credits the customer balance
immediately and must not be linked to a sale (the API rejects non-EXCHANGE
returns).

## Applying the credit

The POS keeps the exchange credit in cart state (`linkedReturnId`,
`exchangeCredit`, `exchangeReturnRef`) and:

- shows an **Exchange credit** row and deducts it from the amount due;
- sends `linkedReturnId` with the sale payload;
- when the credit covers the whole sale, completes through the credit
  confirmation instead of the zero-value flow.

The server (`createSale`) validates the return inside the sale transaction:

- it exists in the tenant, is `COMPLETED`, and has `refundMethod = EXCHANGE`;
- it is not already linked to another sale (`RETURN_ALREADY_LINKED`, 409);
- the credit applies after any store credit, up to the amount still owed;
- any remainder is issued to the linked customer as store credit (a sale with
  no customer is rejected: `EXCHANGE_CREDIT_REMAINDER_REQUIRES_CUSTOMER`).

`EXCHANGE_CREDIT` is a non-collectable tender: it lands in no payment account
and is excluded from cash/card/QR shift totals, while the sale total still
counts in sales.

## Persistence across reloads

The cart snapshot (IndexedDB) stores the exchange credit even when the cart has
no items, so a reload between processing the return and scanning the
replacement items does not lose it. Completing or clearing the sale clears the
credit.

## Verification

- `src/lib/services/__tests__/saleTender.core.test.ts` covers exchange legs
  alone, stacked with store credit, and with a cash/card remainder.
- `src/lib/validators/__tests__/sale.validators.test.ts` covers the
  `linkedReturnId` requirement for `EXCHANGE_CREDIT`.
