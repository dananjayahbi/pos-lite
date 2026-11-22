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

## Storefront vs store profile (ARGUS #487)

The ERP store profile (tenant name/logo/address) supplies receipts, invoices and
internal documents; the public storefront uses its own `WebsiteConfig` brand.
They are deliberately separate, but the profile page did not say so. It now
shows a notice naming the website brand (when configured) and links to
`/settings/website`, so an operator editing the profile knows it will not change
the storefront and can jump to the right place. Editing the profile still does
not rewrite the website brand.

## Receipt identity check (ARGUS #473)

The live profile can drift from the business it belongs to: a QA restore once
left `receiptFooter` naming "Ayur Wellness Centre" on a Ruhunu Weda Gedara
tenant, with no address or phone. The store profile page now renders a
"what the next receipt prints" preview plus an audit (`receiptIdentityIssues`
in `src/lib/settings/receiptIdentity.core.ts`):

- a footer whose "Thank you for shopping at X" names a business other than the
  tenant is flagged - it still prints, but the operator sees the mismatch;
- a missing footer, address or phone is listed, because the receipt would
  otherwise carry no brand contact;
- free-form footers (no shopping-at/with shape) are never treated as another
  brand, and a blank footer uses the shared fallback.

The same helper owns the one footer fallback and the contact-line policy used
by the browser, ESC/POS and A4 receipts (see `receipt-footer-parity.md`).

## Tax effective dates, versions and zero-rate confirmation (ARGUS #475)

Tax writes are no longer immediate last-write-wins. `PATCH /api/settings/taxes`
accepts three optional fields and enforces them server-side:

| Field | Rule |
| --- | --- |
| `effectiveFrom` | `YYYY-MM-DD`; defaults to today. A future date schedules the change. |
| `expectedVersion` | The `taxVersion` the form loaded. A mismatch returns `409 VERSION_CONFLICT`. |
| `acknowledgeZeroRate` | Required (`422 ZERO_RATE_CONFIRMATION_REQUIRED`) when a non-zero rate becomes 0. |

The read/validate/write runs in one transaction with `SELECT ... FOR UPDATE` on
the tenant row, so two managers cannot both pass with the same version. Every
write increments `taxVersion`, stores `taxEffectiveFrom`, `taxPriorRates`,
`taxUpdatedAt` and one bounded `taxRateHistory` entry, and audits
before/after rates plus the effective date (unchanged values do not skip the
audit row).

Money resolution is server-side: `resolveActiveTaxRates` (used by
`extractTenantRates` in `sale.service.ts`, and therefore by sales and
appointment sales) returns the prior rates until the effective date, then the
new ones. A future-dated rate never charges early, and historical sales keep
their snapshotted tax amounts.

The form no longer coerces a cleared input to 0. It keeps the raw string,
shows an inline range error, requires the zero-rate checkbox, shows the
active-vs-scheduled state, and reloads after saving so the new version and
schedule are read from the server.

Pure logic/tests: `src/lib/settings/taxSettingsChange.core.ts` and
`src/lib/settings/__tests__/taxSettingsChange.core.test.ts`.
