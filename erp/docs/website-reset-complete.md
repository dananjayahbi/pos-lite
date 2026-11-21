# Website "Delete all content" is a complete reset

The reset dialog promised a full wipe, but `DELETE /api/store/website` left the
colour palette, typography, announcement bar and appointments configuration in
place. It also deleted only the slide/ad rows while their uploaded files stayed
in storage, and the form kept the leftovers until a reload (ARGUS #497).

## Server reset

`resetWebsiteConfig` now writes `WEBSITE_RESET_CONFIG_DATA`
(`src/lib/website/reset.core.ts`), which covers every field on the
`WebsiteConfig` model:

- branding, SEO and all page copy;
- colours (`#0a0a0a`, `#b4946e`, `#ece2d6`);
- typography (`null` families, default heading/body colours);
- social links, announcement bar, navigation and sections;
- footer, appointments, about, contact and shop settings.

It still deletes every hero slide and ad row.

## Uploaded files

Before the DB rows disappear, the reset collects URL-like strings from the
whole config (including nested `sections`, slides and ads), resolves each
through the tenant-scoped `extractTenantAssetPath`, and calls the storage
`deleteFile` API. External links and unsupported paths are counted as skipped,
never deleted. File deletion is best-effort: the config reset succeeds even when
storage is unavailable, and the response reports the outcome:

```json
{ "reset": true, "deletedAssets": 4, "failedAssets": 0, "skippedAssets": 2 }
```

The UI now shows how many uploaded files were removed and warns when any could
not be removed.

## Form after reset

`DEFAULT_CONFIG` includes the typography and announcement defaults, so the form
immediately reflects the reset instead of hiding stale values until reload. The
confirmation copy now names colours, typography, announcement, appointments and
uploaded files instead of implying a narrower reset.

## Verification

`src/lib/website/__tests__/reset.core.test.ts` covers the complete default field
set (including the previously missed fields), nested asset collection with
deduplication, non-URL copy exclusion and the cleanup summary.
