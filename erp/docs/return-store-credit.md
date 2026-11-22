# Return store credit is issued to the customer

A return refunded as **Store Credit** now adds the money to the original sale's
customer and can be spent at the POS (ARGUS #92). Previously the service created
a `StoreCredit` row with `customerId = null` and never touched
`Customer.creditBalance`, so the receipt promised a credit note that no cart
could use.

## Issuance (`issueCredit`)

`issueCredit()` in `src/lib/services/customer.service.ts` runs inside the return
transaction and writes both halves together:

- `Customer.creditBalance += refundAmount` — the balance the POS reads and
  offers as "Use Store Credit".
- a `StoreCredit` row (`tenantId`, `customerId`, `amount`, note) — the auditable
  credit note.

An audit entry (`CUSTOMER_CREDIT_ADJUSTED`) records the issued amount and the
new balance.

## Customer requirement

Credit is per-customer, so a sale with no linked customer cannot issue it. The
API rejects the method with
`RETURN_STORE_CREDIT_REQUIRES_CUSTOMER` → `422 UNPROCESSABLE` with the message
"Store credit can only be issued for a sale linked to a customer."

The UI mirrors this:

- POS return wizard: the Store Credit option is disabled and explains that the
  sale is not linked to a customer.
- Management **Record Sale → Returns** sheet: the button is disabled with the
  same hint.

## Redemption

`redeemCredit()` now consumes issued credit notes FIFO (`StoreCredit.usedAmount`)
while decrementing `Customer.creditBalance`, so the credit ledger reflects which
notes have been spent. The balance remains the authoritative value the POS
checks before applying credit to a sale.

## Verification

- `src/lib/api/__tests__/map-service-error.test.ts` covers the new sentinel
  mapping.
- The return service path is exercised end-to-end by the returns E2E suite
  (`tests/17_returns_refunds.spec.ts`).
