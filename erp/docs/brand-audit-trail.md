# Brand create/update audit trail

The audit log only had `BRAND_DELETED`; creating a brand or changing its name,
description or logo left no trail (ARGUS #175).

## Behaviour

- `POST /api/store/brands` writes `BRAND_CREATED` with the authenticated
  `session.user.id` as the actor and an `after` snapshot.
- `PATCH /api/store/brands/[id]` writes `BRAND_UPDATED` with the actor and both
  `before` and `after` snapshots.
- Snapshots contain only `name`, `description` and `logoUrl`
  (`lib/catalog/catalogAudit.core.ts`), so relation data and tenant internals
  never leak into the audit log.
- A PATCH that repeats the stored values changes nothing (`changedAuditFields`
  returns an empty list) and therefore writes no row.
- Audit writes use the same non-blocking `createAuditLog` helper as
  `BRAND_DELETED`: a failure is logged server-side and never fails the request.
  Delete behaviour is unchanged.

## Verification

`catalogAudit.core.test.ts` covers the brand snapshot fields, null
normalization, and clearing a description as a changed field.
