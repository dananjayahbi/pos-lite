# Customer pricing rule editor

ARGUS #333. Customer pricing rules had no safe identity or edit path: a
free-text tag was stored as typed (`wholesale` did not match `WHOLESALE`), a
price above the variant retail price was accepted even though the engine skips
such a rule, rules could not be edited, and the tab silently loaded only the
latest 100.

## Canonical customer tag

`src/lib/services/customerTag.core.ts`:

- trims and upper-cases tags (`wholesale` -> `WHOLESALE`);
- the create/update validators apply the canonical form before storage;
- `GET /api/store/customers/tags` returns distinct tags in use with a customer
  count, and the rule dialog uses it as a picker;
- POST/PATCH reject a tag no active customer carries with
  `400 CUSTOMER_TAG_UNKNOWN` (the picker is the UX, the check is the contract);
- `evaluateCustomerPricing` matches rules to customer tags case-insensitively,
  so existing lower-case customer tags still receive a canonical rule.

## Price guard

A variant-specific rule must be at or below that variant's retail price.
POST, PATCH (effective variant + price) and the dialog all enforce it; the API
returns `400 PRICE_ABOVE_RETAIL`. A blank variant ("all variants") has no
single retail price, so it remains an evaluation-time check against each cart
line's unit price.

## Edit flow

The rule dialog now accepts an existing rule: it pre-fills the tag, variant,
price, window and active flag, PATCHes the rule, and shows the API error on
failure. The row has an Edit action next to Deactivate; both are hidden
without `promotion:edit`.

## Pagination

The API caps `limit` at 100. The tab requests 50 per page with `page`, shows
`Showing A-B of N`, and offers Previous/Next plus `Page X of Y`. Tenants with
more than 100 rules can reach every row; the header's live count is explicitly
the count on the current page.

## Verification

- `src/lib/services/__tests__/customerTag.core.test.ts`
- `src/lib/validators/__tests__/customer-pricing.validators.test.ts`
- `npx tsc --noEmit`
