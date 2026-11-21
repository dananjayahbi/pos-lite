# Staff page access and load states

`/staff` is the tenant staff directory. Before ARGUS #344 it rendered for a
cashier even though the API returned 403: the page showed "0 team members", the
New Staff Member button and a full create dialog (including OWNER and
salary/bank fields). Any detail failure also rendered "Staff member not found",
including outages.

## Server gate

`src/app/(store)/staff/page.tsx` is now a server component. It uses
`resolveStaffPageAccess`:

| Session | Result |
| ------- | ------ |
| No user | redirect `/login` |
| Signed in without `staff:view` | redirect `/pos` |
| Signed in with `staff:view` | render the directory |

The directory content lives in `StaffPageClient.tsx`. The server passes
`canManage = hasPermission(user, staff:manage)`, which controls management UI:

- the New Staff Member button and the entire create dialog are hidden;
- the active-status switch is replaced by a read-only Active/Inactive badge;
- the View action remains available.

The API still enforces the same permissions; hiding UI is defense in depth.

## List states

The list query reads the response safely (`readJsonBody` +
`describeApiFailure`) and distinguishes:

- **loading** - skeleton rows and "..." count;
- **error** - "Staff list could not be loaded" row with the human message and a
  **Retry** button; the count reads "Team could not be loaded" instead of
  "0 team members";
- **empty** - "No staff members found" only after a successful response.

## Detail states

`/staff/[staffId]` carries the HTTP status in a `StaffRequestError` and
classifies it:

| Status | Title | Action |
| ------ | ----- | ------ |
| 404 | Staff member not found | Back to Staff |
| 401/403 | You cannot view this staff member | Back to Staff |
| anything else | Staff member could not be loaded | Retry + Back to Staff |

## Verification

`src/lib/staff/__tests__/staffPageState.core.test.ts` covers the access
redirects, the 404/403/load split and the distinct titles.
