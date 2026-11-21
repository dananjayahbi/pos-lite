# Tax and store-profile settings policy (ARGUS #468)

## Tax rates are owner-only

VAT and SSCL feed every sale calculation, so `PATCH /api/settings/taxes` is
**OWNER-only** (SUPER_ADMIN acting in a tenant context is treated as full store
access). The route checks both:

1. `canManageTaxSettings(session.user.role)` — role must be OWNER/SUPER_ADMIN;
2. `settings:tax` permission.

Managers no longer receive `settings:tax` by default (`managerExcluded`), so the
Settings hub/navigation entry disappears for them. A manager who opens the URL
directly sees an explicit “Tax rates are owner-only” card (no form), and the API
returns `403` with the same message even if a stale per-user permission override
still carries the key. Reading rates remains open to authenticated tenant users
because the POS cart needs them.

## Store profile stays manager-editable

`PATCH /api/settings/store` remains gated by `settings:store_profile`
(OWNER + MANAGER by default). Changing the store name/logo/address/contact is a
normal management task; the ticket's owner-only requirement applies to tax
rates. Profile writes are audited so a rename/rebrand is traceable.

The logo upload endpoint only stores a file and returns a URL; the tenant row is
changed by the audited profile PATCH.

## Audit row

Both writes create one `AuditLog` row **inside the same transaction** as the
tenant update:

| Field | Value |
| --- | --- |
| action | `SETTINGS_CHANGED` |
| entityType | `TenantSettings` |
| entityId | tenant id |
| actorId / actorRole | session user |
| before / after | bounded snapshot (see below) |

- Tax: `{ vatRate, ssclRate }`.
- Profile: `{ storeName, logoUrl, address, phoneNumber, receiptFooter }`.

Unrelated tenant settings and secrets (API keys, hardware credentials, etc.) are
never included. If the audit insert fails, the settings change rolls back.

Pure helpers/tests: `src/lib/settings/settingsAudit.core.ts` and
`src/lib/settings/__tests__/settingsAudit.core.test.ts`.
