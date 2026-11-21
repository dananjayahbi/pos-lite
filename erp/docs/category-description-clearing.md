# Clearing a category description

Deleting the text in the Edit dialog left the old description in place because
the client only added `description` to the PATCH body when the trimmed value was
non-empty, so the API never saw the clear (ARGUS #166).

## Behaviour

- The Edit dialog always sends `description`: trimmed text, or `null` when the
  textarea is empty or whitespace only.
- `CategorySchema` / `UpdateCategorySchema` map `""`, whitespace and `null` to
  `null`, trim real text, keep an omitted field `undefined` (so a PATCH that does
  not mention the description leaves it untouched) and still cap the length at
  500.
- The service writes the `null` through to `Category.description`, so the detail
  panel returns to "No description provided".

## Verification

`category.validators.test.ts` covers empty, whitespace, null, trimmed text, the
omitted field and the 500-character cap.
