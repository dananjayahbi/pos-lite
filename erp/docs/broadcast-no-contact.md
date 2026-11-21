# Broadcasts honour the no-contact opt-out

The contact export already excluded customers tagged `no-contact`
(case-insensitive), but the WhatsApp broadcast composer never applied that rule,
so an opted-out customer could still be messaged (ARGUS #317).

## Behaviour

- `hasContactOptOut(tags)` in `customer-contact-export-core.ts` is now the single
  opt-out predicate, matching the tag case-insensitively and ignoring surrounding
  spaces.
- `isContactExcluded` (exports) and the broadcast route both use it. The
  broadcast query selects customer tags and drops opted-out customers before the
  200-recipient limit and before any message is sent.
- The filter applies regardless of the selected tag/spend/birthday filters.

## Verification

`customer-contact-export.test.ts` covers the opt-out predicate (lower/upper case,
whitespace, mixed tags) and keeps the existing export exclusion/count tests.
