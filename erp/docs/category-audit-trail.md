# Category create/update audit trail

The audit log only had `CATEGORY_DELETED`; creating or renaming a category left
no trail, so a changed name, description, sort order or image could not be
traced back to an actor (ARGUS #167).

## Behaviour

- `POST /api/store/categories` writes `CATEGORY_CREATED` with the authenticated
  `session.user.id` as the actor and an `after` snapshot.
- `PATCH /api/store/categories/[id]` writes `CATEGORY_UPDATED` with the actor
  and both `before` and `after` snapshots.
- Snapshots contain only `name`, `description`, `sortOrder` and `imageUrl`
  (`lib/catalog/catalogAudit.core.ts`), so relation data and tenant internals
  never leak into the audit log.
- A PATCH that repeats the stored values changes nothing (`changedAuditFields`
  returns an empty list) and therefore writes no row.
- Audit writes use the same non-blocking `createAuditLog` helper as
  `CATEGORY_DELETED`: a failure is logged server-side and never fails the
  request. Delete behaviour is unchanged.

## Verification

`catalogAudit.core.test.ts` covers the snapshot fields, null normalization, the
changed-field diff and the no-op case.
