# Website asset upload/delete authorization

Website media endpoints now require the website permission and enforce the
tenant prefix (ARGUS #496).

## Routes

| Route | Before | Now |
| ----- | ------ | --- |
| `POST /api/upload/website-asset` | any signed-in user, any tenant | `settings:website` + tenant-scoped key |
| `POST /api/upload/website-asset/delete` | any signed-in user, any bucket path | `settings:website` + tenant-prefix check |

## Tenant scoping

`extractTenantAssetPath()` (`src/lib/storage/asset-paths.ts`) turns a public URL
or bare key into the storage key, but only when the tenant id appears:

- at the start of the key (R2), or
- directly after a known storage folder (`product-images` for Supabase,
  `website-images` / `website-videos` for Cloudinary).

Foreign tenant paths, traversal (`..`, encoded or not) and unknown layouts
return `null` and are counted as `rejected`; they are never sent to the storage
provider. The route also caps a delete batch at 50 URLs.

The upload route already writes to `<tenantId>/website/<images|videos>/...`; it
now rejects users without the website permission before reading the file.

## Verification

`src/lib/storage/__tests__/asset-paths.test.ts` covers R2, Supabase and
Cloudinary URL shapes, bare keys, foreign tenants, unknown folder layouts and
traversal.
