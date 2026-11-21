# Team roster: identity, search and paging

ARGUS #465. The roster rendered only `staffDisplayName(email)` - the mailbox
local part with separators replaced - while the real email existed only as a
`title` attribute. Two people sharing a local part (`cashier1@a.lk`,
`cashier1@b.lk`) looked identical, and there was no search, filter or paging.
The editor dialog title also used the invented display name, so a UI test that
located a row or dialog by email could not find either.

## Contract

- The roster has a separate **Email** column (mono, stable identity) and the
  **User** cell prefers the stored `fullName`, falling back to the mailbox
  alias.
- The editor dialog title is `Manage <email>`; the description shows the
  friendly name and role.
- Filters: free-text search over email/full name/alias, role and
  active/inactive, plus 10-row paging with a "Showing X of Y" count.
- `src/lib/services/staffRosterFilter.core.ts` owns `rosterDisplayName`,
  `filterStaffRoster` and `paginateStaffRoster`, so the behaviour is unit
  tested without a browser.
- `GET /api/store/staff` now includes `permissions` (access metadata) so the
  roster can show the explicit extras/revokes it already advertises.

## Verification

- `src/lib/services/__tests__/staffRosterFilter.core.test.ts`
- `npx tsc --noEmit`
