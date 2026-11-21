# Clearing a brand description

Deleting the text in the Edit Brand dialog left the old description in place:
the client only added `description` to the PATCH body when the trimmed value was
non-empty, so the API never saw the clear (ARGUS #174, same defect as ARGUS #166
for categories).

## Behaviour

- The Edit Brand dialog always sends `description`: trimmed text, or `null` when
  the textarea is empty or whitespace only.
- `BrandSchema` / `UpdateBrandSchema` map `""`, whitespace and `null` to `null`,
  trim real text, keep an omitted field `undefined` (so a PATCH that does not
  mention the description leaves it untouched) and still cap the length at 500.
- `createBrand` / `updateBrand` accept `description: string | null` and write
  the `null` through to `Brand.description`, so the detail panel returns to
  "No description provided".

## Verification

`brand.validators.test.ts` covers empty, whitespace, null, trimmed text, the
omitted field and the 500-character cap.
