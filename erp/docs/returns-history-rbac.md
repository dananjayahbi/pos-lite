# Returns ledger access

The `/returns` page rendered for any signed-in role and `GET /api/store/returns`
only required `sale:view`, so a cashier could read every tenant return (amounts,
methods, reasons, original sale context) even though the Sales page redirected
them away (ARGUS #100).

## Fix

- The management Returns page is now a server component gated by the same
  `sale:view_history` permission as the Sales ledger; other roles are redirected
  (cashiers use the POS return wizard).
- `GET /api/store/returns` (the history list) requires `sale:view_history` too,
  returning 403 otherwise. The POS return wizard does not call this list; it
  creates returns and looks up a specific sale reference, so terminal return
  flows are unchanged.
- POST (processing a refund) still requires `sale:refund`; the detail/receipt
  endpoints remain available to the roles that can reach them.

## Verification

`tsc` covers the page/route wiring. Cashier access is denied at both the page and
the API; manager/owner retain the ledger.
