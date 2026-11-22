# My Account: display name and date convention

ARGUS #506. The profile card printed `staffDisplayName(email)` (the mailbox
local part) even when `User.fullName` was stored, and formatted `lastLoginAt`
and `createdAt` with `toLocaleString('en-US')` - month-first, 12-hour browser
time - while the rest of the ERP shows `28 Oct 2026, 21:11`.

## Contract

- `GET /api/settings/account` selects and returns `fullName`.
- `resolveAccountDisplayName` uses the trimmed full name when present and only
  falls back to the mailbox alias otherwise.
- `formatAccountTimestamp` delegates to the shared `formatShortDateTime`
  helper (day-first, 24-hour, `-` for null/invalid), so the card matches the
  ledger and detail pages.
- The live `fullName` may be empty; the fallback stays intentional and is
  covered by a test.

## Verification

- `src/lib/services/__tests__/accountProfile.core.test.ts`
- `npx tsc --noEmit`
