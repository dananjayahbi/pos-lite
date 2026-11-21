# Audit detail for deletion rows

Audit rows for deletions store `before` with no `after`. The detail modal only
handled both-sides diffs and after-only creates, so a deletion showed "No detail
data recorded." even though the API row held the deleted amount/category/etc.
(ARGUS #454).

`auditDetailMode(before, after)` now returns `diff`, `created`, `deleted` or
`none`. A before-only row renders a red **Deleted values** table. The CSV export
already includes the `before`/`after` payloads from ARGUS #453.

## Verification

`auditDetail.core.test.ts` covers diff, created, deleted and empty inputs.
