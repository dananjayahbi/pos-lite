# Store profile logo upload

`/settings/store` → **Store logo** lets a tenant upload its own logo instead of
pasting a URL. Files are stored through the configured storage provider
(Cloudflare R2 in production) and the returned public URL is saved to
`Tenant.logoUrl`.

## Flow

1. The operator picks a file with **Upload logo** (or **Replace logo**).
2. The browser posts it as `multipart/form-data` to
   `POST /api/settings/store/logo`.
3. The route authenticates the session, requires
   `settings:store_profile`, and derives the tenant from the session — the body
   cannot choose another tenant.
4. `uploadFile()` writes the object to
   `<tenantId>/logo/store-logo-<timestamp>` in the configured provider and the
   route returns `{ url }`.
5. The form previews the URL and marks itself dirty; **Save Store Profile**
   persists it with `PATCH /api/settings/store` (`logoUrl` must be a URL or
   empty). **Remove** clears the preview and saves an empty `logoUrl`.

The upload itself does not write to the database: leaving the page before saving
keeps the previous logo (the new R2 object is simply unreferenced, like other
image uploads).

## Limits

| Rule | Value |
| --- | --- |
| Accepted types | JPEG, PNG, WebP, SVG |
| Max size | 2 MB |
| Permission | `settings:store_profile` (OWNER / MANAGER) |
| Tenant scope | Session tenant only |

`Tenant.logoUrl` feeds the POS header, receipt/invoice headers, tenant favicon,
payroll documents and customer-facing surfaces.

## Shared uploader

`src/components/shared/LogoUploadField.tsx` is the single uploader widget; it
takes an `uploadUrl` prop. `BrandLogoUpload` wraps it for
`/api/store/upload/brand-logo`, and the store-profile form points it at
`/api/settings/store/logo`.

## Tests

- `tests/07_settings_taxes_hardware.spec.ts` → `F9` covers wrong MIME, oversized
  files, the valid-upload response (200, or a provider-500 without credentials)
  and anonymous rejection.
- `tests/07_settings_taxes_hardware.spec.ts` → `F10` mocks the upload endpoint,
  selects a PNG through the file input, asserts the preview and confirms the
  saved PATCH payload contains the uploaded `logoUrl`.
