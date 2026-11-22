# Brand description limit

The Brand dialog (both New Brand and Edit Brand) accepted 520 description
characters and left Save enabled, while `BrandSchema`/the API caps the field at
500. The save failed late with a server validation error (ARGUS #177).

## Behaviour

- The description textarea uses `maxLength={500}` and shows a live `n/500`
  counter.
- Save is gated by `validateBrandForm()` in
  `src/lib/brands/brandForm.core.ts`; a description over
  `BRAND_DESCRIPTION_MAX` (500) is invalid and shows an inline error, even if
  the input cap is bypassed.
- The same helper builds the payload for both create and edit, so an empty
  description still clears to `null` and an explicit logo removal still sends
  `null`.

## Verification

`brandForm.core.test.ts` covers the 500 boundary, a 520-character rejection,
blank-to-null description and logo passthrough.
