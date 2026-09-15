# M07-02 — OBS-81: `/settings/store` redirect stub + orphaned store-profile form (corrected: `/settings/account` now EXISTS)

**Severity:** P3-Minor (dead surface / confusion) · **Module:** 07 Settings · **QA refs:** OBS-81, `tests/07` S7 pin · **Depends on:** nothing

## Verified source state (2026-09-15) — partially STALE, correct the QA claim
- **Holds:** `src/app/(store)/settings/store/page.tsx:5-8` is a pure redirect stub → `/dashboard` ("store profile settings are now managed by the super admin"). `src/components/settings/StoreProfileSettingsForm.tsx` is **orphaned** — no app-code importer (only QA docs reference it); its `handleSave` PATCHes `/api/settings/store`, which works (QA verified the API round-trip) but no UI reaches it.
- **No longer true:** QA's "Sidebar 'My Account' → `/settings/account` 404s (dead link, S7 pin)" — `src/app/(store)/settings/account/page.tsx` **exists** (renders `AccountSettingsClient`) and `StoreSidebar.tsx:353` links to it. The S7 pin (if it asserts 404) will now behave differently — re-verify before implementing.

## Fix approach (decide the intended product shape, then act)
Store-profile editing today = superadmin tenant settings (per the stub's comment) + the live `/api/settings/store`. Two coherent options:
1. **Restore tenant self-service:** mount `StoreProfileSettingsForm` at `/settings/store` (it's already written and the API is verified) gated on `settings:store_profile`; keep superadmin as the system-owner surface. Recommended — the client's req 1.x treats store settings as owner territory.
2. **Remove the dead surface:** delete the stub page + orphaned form, and if superadmin-managed-only is truly the design, make that explicit in nav (no `/settings/store` entry).
Whichever: update the S7 pin expectation in the relocated spec to match (page 200 + form works, or 404-by-design).

## Files
- `src/app/(store)/settings/store/page.tsx`, `src/components/settings/StoreProfileSettingsForm.tsx`, sidebar config (`StoreSidebar.tsx`), `tests/07` S7.

## Acceptance
- No orphan components in `src/components/settings/` (grep-import check passes); `/settings/account` verified live (200 for OWNER); the store-profile path chosen is coherent end-to-end (nav → page → API → audit).
