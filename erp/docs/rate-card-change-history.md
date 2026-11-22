# Rate card shows last change and applies changes immediately

Saving a rate card changed every quote instantly, but the page showed no
`updatedAt`, no last editor, and the audit row carried only the new values with
`actorRole: UNKNOWN` (ARGUS #295).

## Behaviour

- `Tenant.settings.delivery.rateCardMeta` records the last base-card or
  zone-matrix write (timestamp, user email, role, `card`/`entries`). No schema
  change.
- The page header shows `rateCardMetaSummary()`: e.g. "Base rates updated
  22 Nov 2026, 10:30 by Owner (owner). Effective immediately for new quotes and
  new or edited deliveries."
- Both rate-card routes now write `before` and `after` snapshots with the real
  actor role. Base-card saves record the six rate fields; zone saves record the
  previous matrix rows (destination + rates) and the new row count.
- There is no future-dated effective field in the data model, so the page states
  the actual behaviour: the change is effective immediately.

## Verification

`src/lib/delivery/__tests__/rateCardMeta.core.test.ts` covers initial, base-rate
and zone-update summaries. `tsc --noEmit` covers the route/service plumbing.
