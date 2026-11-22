# Waybill template audit trail is reviewable

Template saves and resets were both written as `LABEL_TEMPLATE_UPDATED` with no
before/after values, the actor role was always `UNKNOWN`, and the designer had
no change history (ARGUS #306).

## Behaviour

- Every save/reset writes an `AuditLog` row with `actorRole` from the session
  and a sender snapshot in `before`/`after` (`brandName`, `fromContact`,
  `pickupAddress`). A reset records `after: null` because it removes the saved
  override; the Store Profile sender remains.
- `getLabelTemplateHistory()` returns the last five rows and resolves the actor
  email, so the payload carries both the acting user and role.
- The designer's **Recent changes** card shows the timestamp, actor, role and
  each changed field as `old → new` (or `(cleared)`).
- `labelSenderChanges()` is a pure helper: unchanged fields are omitted, so a
  no-op save is visible as such.

## Verification

`src/lib/delivery/__tests__/labelAudit.core.test.ts` covers snapshot parsing and
changed-field extraction. `tsc --noEmit` covers the route/service wiring.
