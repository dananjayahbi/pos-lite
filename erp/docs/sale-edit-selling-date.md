# Sale edit preserves the selling timestamp (ARGUS #88)

The edit sheet's date input is day-granular and the save handler always sent
`<date>T12:00:00`, so changing only the customer or delivery charge rewrote a
sale entered at 23:04 to 12:00.

## Rule

- **Sheet**: `saleEditDatePayload` compares the chosen `yyyy-mm-dd` with the day
  seeded from `saleDate ?? createdAt`. If the day is unchanged it returns `{}`,
  so `saleDate` is absent from the PATCH and the service leaves it alone. Only a
  changed day produces the existing noon-local anchor.
- **Service**: if a client does send a same-day `saleDate` (another surface, or
  a future form that submits the untouched value), `preserveSellingTimestamp`
  keeps the recorded `before.saleDate ?? before.createdAt`. A different
  calendar day accepts the incoming timestamp.

`src/lib/sales/sale-edit.ts` holds `sameSellingDay` and
`preserveSellingTimestamp`; `src/components/sales/saleEditPayload.ts` holds the
client payload builder. Both are pure and unit tested.

## Verification

`src/components/sales/__tests__/saleEditPayload.test.ts` covers the unchanged
day, an intentional day change, the server same-day guard and the changed-day
path.
