# Team & Permissions UI test contract

ARGUS #467. Several Module 03 cases still asserted the old page: they located
rows by email while the row rendered only `staffDisplayName(email)`, expected
the dialog title to contain the email while it said `Manage Cashier 1`, clicked
Save on an unchanged draft, and expected a superadmin bounce that the page
guard now performs. They also missed the duplicate-explicit count, permission
mismatch, high-risk grants, last-owner/self-deactivation and the list-error
state.

## Aligned contract (`tests/03_rbac_users.spec.ts`)

| Case | Contract |
| --- | --- |
| 1.1 | roster row is found by the visible email column |
| 1.5 | dialog title is `Manage <email>`; inherited rows are badge + enabled revoke control; Save is disabled until dirty |
| 1.6 | Extras cell names overrides and starts with `<n> extra` |
| 5.3 / 7.1 / 7.3 | the case makes a real grant (report:view_sales) before Save, because an unchanged Save is intentionally disabled |
| 8.5 | `denialRouteFor` sends SUPER_ADMIN to `/superadmin/dashboard` |

## Added coverage

- 1.7 duplicate stored extras normalize to one override (API + roster);
- 1.8 a `staff:view`-only viewer loads the roster read-only: no Manage/Save;
- 1.9 a high-risk grant (settings:users) requires the confirmation dialog;
- 1.10 the last owner cannot be deactivated (`409 LAST_OWNER_REQUIRED`);
- 1.11 a roster 500 shows the error state with Retry, never "No team members".

Changing a target user bumps `sessionVersion`; tests that mutate the cached
identities call `invalidateStorageState` (existing helper) as before.

## Verification

Playwright is not run by the module agent (needs the dev server). `tsc` covers
the spec types; the pure grid/roster logic is covered by vitest.
