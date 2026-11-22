# Website CMS - storefront preview links

ARGUS #500: the Appointments tab linked to `http://localhost:3002/appointments`,
which 404s because storefront pages are scoped by tenant slug. The real page is
`/dilani/appointments`.

## Implementation

- `settings/website/page.tsx` resolves the tenant slug server-side (same
  tenant as the session) and passes it to the client form.
- `AppointmentsTab` builds the link after mount with
  `buildStorefrontPreviewUrl()` (`src/lib/website/storefront-url.core.ts`):
  - keeps the slug path prefix;
  - strips a leading `admin.` host label in production;
  - remaps the local ERP port `:3003` to the storefront `:3002`.
- If the slug is unavailable the link is omitted rather than pointing at a
  404.
- The helper is pure and unit-tested; the tab no longer reads `window` during
  render, so there is no hydration mismatch.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/website/__tests__/storefront-url.core.test.ts`
