# Store credit is a tender

Store credit redeemed at the POS lowers the amount the customer pays, and it is
persisted as a payment leg rather than a display-only deduction (ARGUS #61).
Before this change a 2,184.75 sale with 1,500.00 credit showed 684.75 due, but
the API recorded 2,184.75 as cash/card **and** deducted the 1,500.00 credit.

## Model

| Concept                | Where it lives                                   |
| ---------------------- | ------------------------------------------------ |
| Sale value             | `Sale.totalAmount` (unchanged by credit)         |
| Credit redeemed        | `Payment` leg with `method = STORE_CREDIT`       |
| Cash/card/QR collected | Remaining `Payment` legs                         |
| Customer balance       | `Customer.creditBalance` (decremented on redeem) |

The identity `sum(payments) === Sale.totalAmount` always holds, so the drawer,
shift report and payment-account ledger reconcile against money that actually
moved.

## Partial credit

The chosen tender settles only the payable remainder:

```
payable = totalAmount − appliedStoreCredit
legs    = [<cash/card/QR/split legs for payable>, STORE_CREDIT leg for credit]
```

Cash change is computed from `cashReceived − payable` (or the cash part of a
split), never from the full sale total.

## Fully covered credit

A sale settled entirely by credit is **not** a zero-value sale — it has a real
total and a real tender, so it never asks for a zero-value reason. The API:

- persists `paymentMethod = STORE_CREDIT`,
- writes one `STORE_CREDIT` payment leg for the full total,
- writes no cash/card account entries (`buildSaleAccountLegs` returns none).

The POS opens the **Complete with Store Credit** confirmation instead of the
zero-value dialog.

## Validation

The API rejects credit that:

- exceeds the sale total (`STORE_CREDIT_EXCEEDS_TOTAL`),
- exceeds the customer's balance (`STORE_CREDIT_EXCEEDS_BALANCE`),
- is applied to a guest sale (`STORE_CREDIT_REQUIRES_CUSTOMER`),
- is chosen as the tender but leaves a payable remainder
  (`STORE_CREDIT_DOES_NOT_COVER_TOTAL`).

An attempt to pay the remainder with a card portion larger than `payable`
returns `CARD_AMOUNT_EXCEEDS_PAYABLE`.

## Reporting

Tender totals for shift close and shift summary now aggregate `Payment` legs
(`sumPaymentBreakdown`) instead of reading `Sale.paymentMethod`. Store-credit
legs are excluded from cash/card/QR totals; the sale value itself still counts
in total sales. This also fixes SPLIT sales, which were previously absent from
the cash/card breakdown.

`EXCHANGE_CREDIT` is a separate tender funded by an exchange return; see
[`exchange-credit.md`](./exchange-credit.md).

Editing a sale's delivery charge keeps the `STORE_CREDIT` leg fixed (it is
pinned to the customer's balance) and re-scales only the cash/card legs. An edit
that would push the total below the redeemed credit, or add a charge to a
credit-only sale, is rejected with `INVALID_DELIVERY_CHARGE`.

## Verification

- Unit: `src/lib/services/__tests__/saleTender.core.test.ts`,
  `src/lib/validators/__tests__/sale.validators.test.ts`.
- The migration adding the enum values is
  `prisma/migrations/20261121120000_add_store_credit_payment_method`.
