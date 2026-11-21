# Petty Cash page permission gate (ARGUS #409)

`GET /api/store/petty-cash` required `petty_cash:view`, but `/petty-cash` was a
client-only page. A cashier reached the heading, Export, Add Cash In and Save
Categories, then every request returned 403.

## Resolution

`src/app/(store)/petty-cash/page.tsx` is now a server component:

1. unauthenticated users go to `/login`;
2. a tenantless session uses the shared `denialRouteFor` target;
3. `resolvePettyCashPageAccess` checks `petty_cash:view` and non-viewers are
   redirected to `/dashboard` before the client renders.

The page passes the action flags to `PettyCashDashboard`:

| Flag                | Hides                                                |
| ------------------- | ---------------------------------------------------- |
| `canManage`         | Add Cash In, category switches/Save, Setup button    |
| `canManageSettings` | Settings dialog (owner-only, `petty_cash:settings:manage`) |
| `canCreateExpense`  | Add Expense deep link                                |

Export stays visible to any viewer because the page gate already established
`petty_cash:view`; the export API now checks the same `petty_cash:view` key
instead of `expense:view`, so the page and endpoint agree.

All money and permission decisions remain server-side. The client flags only
stop dead controls from being shown.

## Verification

`src/lib/petty-cash/__tests__/access.test.ts` covers cashier denial, owner,
manager (no fund settings), a view-only override and a missing user.
