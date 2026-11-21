# Waybill recipient completeness

ARGUS #300. Deliveries without a shipping address printed a courier waybill
with `To -`, `Address -`, `Branch -` and `Contact -`. That looks deliverable but
cannot be routed, so printing is now blocked and the missing fields are shown.

## Required fields

`src/lib/delivery/waybillCompleteness.ts` requires:

- recipient name
- contact number (the second phone is optional)
- address line 1
- city or district (either one satisfies the branch row)

Postal code and address line 2 are optional. Whitespace-only values count as
missing.

`waybillRecipientPrintDecision(address)` returns `canPrint`, the missing field
labels and a ready-to-show `reason`.

## Enforcement

- `printShippingLabel` throws before rendering when the recipient block is
  incomplete.
- `printShippingLabels` blocks a batch and names up to three affected order
  references with their missing fields.
- Detail, Deliveries & Tracking rows, Dispatch Orders rows and the dispatch
  sheet disable the Waybill action and show the missing-field warning.
- The detail and dispatch sheet show a visible amber warning; list rows show
  the reason in the Waybill/status cell.
- Bulk dispatch-order printing rejects the batch with a toast listing the
  affected orders.

There is no server-side print endpoint; the print guard is the shared last line
of defence for every client print path.

Tests: `src/lib/delivery/__tests__/waybillCompleteness.test.ts`.
