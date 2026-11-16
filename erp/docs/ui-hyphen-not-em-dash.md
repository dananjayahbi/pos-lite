# UI copy uses hyphens, not em dashes

Refactor #1 - the client asked for the typographic em dash (U+2014) to be
replaced with a plain hyphen (`-`, U+002D) everywhere it is visible in the UI.
Logical values, identifiers and developer comments were allowed to stay, but no
screen may render an em dash.

## Scope

The change was applied to the frontends:

- `erp/src` (admin ERP) - 492 occurrences in 206 files.
- `website/src` (customer storefront) - 14 occurrences in 12 files.

Only **string literals, template-literal text and JSX text** were rewritten. The
migration was done with a TypeScript AST pass, not a blind search/replace, so:

- comments keep their original prose (they are not UI);
- regular expressions, imports, identifiers and code paths are untouched;
- template text (`... ${value} ...`) is handled inside its quasi nodes;
- test fixtures/assertions were rewritten alongside the labels they assert, so
  the suite stays consistent.

Examples of the affected copy: empty-value placeholders (hyphen instead of em
dash),
date/time separators, toast and API error messages, report headings, payslip and
invoice text, label defaults and storefront checkout/shop copy.

## Guard

`src/lib/__tests__/no-em-dash-ui.test.ts` parses every non-test `.ts`/`.tsx`
file under `erp/src` (skipping `generated/`) and fails if any em dash appears in
a string literal, template quasi or JSX text. Comments are ignored by the AST,
so documentation and developer notes are not constrained. Add new UI copy with
a hyphen and the guard stays green.

## Verification

- `yarn vitest run` in `erp` - 93 test files / 829 tests passed (includes the
  new guard).
- `yarn tsc --noEmit` in `erp` - passed.
- `yarn vitest run` and `yarn tsc --noEmit` in `website` - passed (15 tests).
- Browser spot-check of `/dashboard`, `/notifications`, `/appointments`,
  `/appointments/list`, `/appointments/settings`, `/reports/revenue-trend` and
  `/returns`: `#main-content` text contains no em dash character.

## Files

- `src/lib/__tests__/no-em-dash-ui.test.ts`
- UI string literals across `erp/src` and `website/src` as listed by the patch.
