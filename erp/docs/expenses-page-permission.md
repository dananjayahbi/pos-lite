# Expenses page permission gate (ARGUS #398)

`GET /api/store/expenses` already required `expense:view`, but
`/expenses` was a client-rendered page with no server check. A role without
the permission (for example a cashier) reached the shell, saw Add Expense and
Export, and only discovered the denial when the list fetch returned 403.

## Resolution

`src/app/(store)/expenses/page.tsx` is now a server component:

1. unauthenticated users are redirected to `/login`;
2. a session without a tenant uses the shared `denialRouteFor` target;
3. `resolveExpensePageAccess` checks `expense:view` and non-viewers are
   redirected to `/dashboard` before any client code renders.

The page passes boolean flags to `ExpensesPageClient`:

- `canCreate` hides **Add Expense** and the edit control when absent;
- `canApprove` is required for the edit control (edits are an approval
  decision, see `expenses-approval-policy.md`);
- `approvalThreshold` is the server-resolved value used in the on-page hint.

All money and permission decisions remain server-side in the API routes; the
client flags only prevent dead controls from being shown.

## Verification

`src/lib/expenses/__tests__/access.test.ts` covers cashier denial, owner and
manager access, a narrow explicit override, and a missing user.
