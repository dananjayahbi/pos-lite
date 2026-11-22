# Dispatch search matches phone numbers

The dispatch search box said "Search orders, customers..." but the API only
matched `orderRef`, `courierOrderRef`, address full name and waybill. A phone
lookup such as `0771234567` returned zero rows even though dozens of deliveries
carried that number (ARGUS #268).

## Behaviour

- `getDeliveries` now matches the recipient phone, the alternate phone
  (`phone2`), the linked customer's phone and the customer's name.
- `phoneSearchVariants()` adds the common phone spellings, so a compact
  `0771234567` also matches `077 123 4567` and `077-123-4567`, and a spaced
  entry matches the compact column.
- Non-phone searches (order refs, names) are unchanged; the raw term is always
  tried first.
- Both the dispatch and delivery list placeholders now say "phone".

## Verification

`src/lib/delivery/__tests__/search.core.test.ts` covers spaced/compact numbers,
common formats, non-phone text and blank input.
