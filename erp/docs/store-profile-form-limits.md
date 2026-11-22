# Store profile form limits and logo lifecycle (ARGUS #476)

The API always capped the profile fields, but the form did not show the limits
and a long value only surfaced as a generic toast. The form now uses the same
`STORE_PROFILE_LIMITS` map as the zod schema:

| Field | Limit | UI |
| --- | --- | --- |
| Store name | 80 | `maxLength` + counter + inline min-2 error |
| Address | 160 | `maxLength` + counter |
| Phone number | 40 | `maxLength` + counter |
| Receipt footer | 240 | `maxLength` + counter |
| Email (invoice header) | 120 | format check once the field exists |

Server validation returns `error.fields` keyed by field name, so the form can
show the exact API message inline instead of only a toast.

## Logo lifecycle

- SVG is no longer accepted for store logos (upload route, shared
  `LogoUploadField` and copy). Raster JPEG/PNG/WebP keeps the 2 MB cap. A logo
  URL must be `http(s)` or a root-relative `/...` path.
- Replacing a logo now deletes the previous stored object **after** the audited
  PATCH commits, using the provider-aware key extraction in
  `src/lib/storage-keys.core.ts` (R2 public base, Cloudinary upload path,
  Supabase public bucket). Manual CDN URLs are never deleted because the app
  does not own them; a storage failure is logged and never fails the save.

## Tax inputs

Clearing a tax field no longer writes 0; it shows an inline range error and
Save stays disabled (see the tax-scheduling section above).

Pure logic/tests: `src/lib/settings/storeProfileLimits.ts`,
`src/lib/storage-keys.core.ts`, `storeProfileLimits.test.ts`.

## Dirty-state guard and reset (ARGUS #493)

The store profile form used to lose edits silently: typing a suffix enabled
Save, but navigating away and back reset the form with no prompt, and a cleared
name disabled Save with no explanation. Now:

- a `beforeunload` prompt covers tab close, reload and back/forward;
- a capture-phase click guard confirms in-app link navigation while dirty
  (Ctrl/Cmd/Shift/middle-click and `target="_blank"` are left alone);
- every blocked Save state has operator copy (`storeProfileSaveBlockMessage`):
  short name, in-flight logo upload, saving, or a highlighted field error;
- an always-visible status line announces "Unsaved changes - Save applies them";
- **Cancel changes** restores the last saved values (and clears server field
  errors), so a user can abandon an edit deliberately.

The prompt/copy helpers are pure and tested in `storeProfileSave.core.test.ts`.
