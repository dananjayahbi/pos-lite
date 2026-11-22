# Staff directory - create/edit and presentation consistency

ARGUS #346 collected several mismatches on `/staff` and `/staff/[id]`.

## Create / edit

- **Commission rate** is shown for every role on create, matching edit. The
  server contract is unchanged (0-100, optional).
- **Role dropdown** uses `assignableRolesFor(actorRole)`: a manager no longer
  sees OWNER/MANAGER, and only an owner/super-admin sees OWNER. The server
  hierarchy check remains the enforcement point.
- **Status switch** opens a confirmation dialog before activating or
  deactivating. Deactivating yourself warns about immediate lockout;
  deactivating an OWNER states that the last active owner is protected by the
  server (`LAST_OWNER_REQUIRED`). The switch has an accessible name.

## List

- Added an Email column.
- Added 10-row client-side pagination with Previous/Next and a page count.
  Search and role changes reset to page 1.

## Detail / commission

- All staff and commission timestamps use the shared `formatShortDate`,
  `formatShortTime` and `formatShortDateTime` helpers (`28 Oct 2026, 20:45`),
  removing the mixed en-LK/en-US output.
- Sale and payout ids are shown in full instead of 8-character fragments.
- Payslip PDF and Attendance CSV use `StaffDocumentDownloadButton`, which shows
  "Preparing…", surfaces the API error message, and only saves a real file (a
  failed request no longer downloads an error envelope).

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/auth/__tests__/staff-authorization.test.ts src/lib/validators/__tests__/staff.validators.test.ts`
