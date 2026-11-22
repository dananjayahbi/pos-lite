# Settings QA fixture hygiene (ARGUS #478)

The Module 07 Playwright suite PATCHes live tax and store settings. Its cleanup
used to write `Ayur Wellness Centre` and that tenant's footer back, so the live
tenant's brand/contact/footer became a test fixture - the cause of the receipt
that named another business (ARGUS #473).

## Capture and restore

`F0` now captures, from the server-rendered pages:

- `vatRate` / `ssclRate` (tax form), and
- store name, address, phone, receipt footer and logo URL (store profile form).

Every destructive test restores those captured values:

- `X1` (XSS payload) and `X4` (Unicode footer) call `restoreStoreProfile`.
- `F8` (API-only PATCH) writes the captured name/logo/phone/footer, not a
  hardcoded brand.
- `T2`/`Z1` call `restoreTaxRates` (with `acknowledgeZeroRate: true`, because a
  captured 0% is a legitimate baseline) and `restoreStoreProfile`.

A fresh suite run therefore leaves the live tenant exactly as it found it, even
on a non-seed tenant such as Ruhunu Weda Gedara.

## Financial-control coverage added

| Control | Coverage |
| --- | --- |
| Owner-only tax writes | `F2c` asserts a MANAGER PATCH gets `403 FORBIDDEN`. |
| Audit row with before/after | `F2a` reads `/api/audit-logs?entityType=TenantSettings` and asserts `SETTINGS_CHANGED`, the new VAT and the effective date. |
| Optimistic concurrency | `F2b` sends a stale `expectedVersion` and asserts `409 VERSION_CONFLICT`. |
| Zero-rate confirmation | `taxSettingsChange.core.test.ts` (server guard); the UI checkbox is the same rule. |
| VAT and SSCL never stack | `taxRules.core.test.ts`; `F1` asserts the separate "VAT only" / "SSCL only" preview. |
| No fixed 15% product label | `taxLabels.test.ts` / `taxLabelsSurfaces.test.ts`. |
| Receipt tax / registration identity | `taxIdentity.core.test.ts`; `F1` asserts the identity card stays visible. |
| Historical reprints | `receipt-identity.core.test.ts`, `receipt-renderer.test.ts`, `return-receipt-renderer.test.ts`. |

The schedule itself (effective date, version bump, prior rates) is unit-tested in
`src/lib/settings/__tests__/taxSettingsChange.core.test.ts`.
