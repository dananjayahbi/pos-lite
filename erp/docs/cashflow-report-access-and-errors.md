# Cash Flow report access and load errors (ARGUS #421)

The Cash Flow page had no client-side permission check and no failure surface.
A user without `report:view_cashflow` saw only the heading and date controls,
and after clicking Generate an aborted, 403 or 500 request removed the report
with no message or way to retry.

## Rule

`resolveCashFlowReportState` in `src/lib/reports/cashflowReportState.ts` is a
pure state machine over:

- session permission loading / `canView`;
- whether Generate has run;
- query loading state;
- the request error (HTTP status + message);
- whether the loaded period has activity.

It resolves exactly one mode: `permission-loading`, `denied`, `idle`,
`loading`, `error`, `empty` or `ready`. Only `ready` sets `showReport`, so a
failed or forbidden request can never leave a stale/partial report on screen.

## UI

- `usePermissions()` checks `PERMISSIONS.REPORT.viewCashflowReport`; the query
  is disabled until the session resolves and the permission is present.
- Missing permission renders an **Access Restricted** card with a way back to
  the dashboard.
- Generate sends a typed `CashFlowRequestError` carrying the HTTP status. A 401
  or 403 maps to the denied state; any other failure (aborted, network, 500)
  renders an error card with **Try again**, which refetches the same window.
- Loading, idle and empty states are explicit.
- The API remains the authority: this client gate only improves the empty-page
  experience and never replaces the server permission check.

## Verification

`src/lib/reports/__tests__/cashflowReportState.test.ts` covers permission
loading, denied, idle, loading, a 500 error with retry, a server 403, empty and
ready. The report is hidden in every state except `ready`.
