# Customer drawer: layout and edit pre-fill

The New/Edit Customer drawer (`CustomerSheet`) is used from both the customer
list and the customer detail page.

## Layout

The sheet is a fixed-height, three-part column:

```
┌───────────────────────────────┐
│ Header (title + description)  │  fixed
├───────────────────────────────┤
│ Scrollable form body          │  only this area scrolls
│  Contact details              │
│  Address (address + city)     │
│  Personal details             │
│  Tags                         │
│  Notes                        │
├───────────────────────────────┤
│ Cancel / Create or Update     │  fixed footer, always visible
└───────────────────────────────┘
```

Previously the whole sheet scrolled and the submit row used `sticky bottom-0`
with negative margins, so it overlapped the Tags/Notes fields and the Create
button could be hidden below the fold. The footer is now a sibling of the
scroll area, so it never covers a field and never scrolls away.

The sheet is `sm:max-w-2xl` and the header reserves space for the close button
(`pr-12`).

## Edit pre-fill

All customer fields are mapped from the API row into form values:

| API column | Form control |
| --- | --- |
| `name`, `phone`, `phone2` | text/tel inputs |
| `email` | email input (`null` → empty) |
| `address` | textarea |
| `city` | city select (the current value is kept even if the master list has not loaded it) |
| `gender` | gender select |
| `birthday` | `<input type="date">` (`YYYY-MM-DD`) |
| `tags` | tag badges + preset buttons |
| `notes` | textarea |

The mapping lives in `src/lib/utils/customer-form.ts` (`customerToFormValues`)
and is unit-tested, so the pre-fill contract cannot silently drift.

The drawer resets in two situations:

- when it opens, and
- when the selected customer's *values* change.

It does **not** reset when the list refetches an identical customer object,
which previously could wipe half-typed edits. On open the scroll position is
also reset to the top, so a drawer left scrolled from a previous New form shows
Name/Phone first instead of opening halfway down.

## Clearing optional fields on edit

Empty inputs now persist as `null` for the fields that support clearing:

- Contact No 2, address, city
- Email (`''`/`null` → `null`)
- Birthday (`''`/`null` → `null`)
- Notes (`''` → `null`)

`UpdateCustomerSchema` accepts `null` for email/birthday and normalizes blank
strings to `null`; `updateCustomer` writes the null instead of skipping the
field.

## Tests

- `src/lib/utils/__tests__/customer-form.test.ts` — new-customer defaults,
  full edit pre-fill, nullable → empty normalization, no source mutation.
- `src/lib/validators/__tests__/customer.validators.test.ts` — email/birthday
  clearing, email normalization, malformed-value rejection.
