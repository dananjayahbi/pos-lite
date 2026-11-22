# Website CMS - YouTube social link editor

ARGUS #501: `socialLinks.youtube` was already persisted and rendered by the
storefront, and the config validator accepted it, but the General tab only
offered Facebook, Instagram, Email, Phone, WhatsApp and TikTok. A live YouTube
link could therefore not be edited or removed.

## Change

- The General tab's Social Links section now has a **YouTube URL** field bound
  to `socialLinks.youtube`.
- Clearing it saves an empty value; the storefront already skips empty links,
  so the icon disappears without touching stored config elsewhere.
- No schema or API change was needed. URL validity is enforced by
  `WebsiteSocialLinksSchema.youtube`.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/website/__tests__/load-state.test.ts`
