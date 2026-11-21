# Sales history API scope (ARGUS #78)

## Decision

`GET /api/store/sales` is a shared endpoint: the Sales page uses it for the
tenant-wide ledger, and the POS uses it for shift/held-sale checks. The page
already required `sale:view_history`; the API only required `sale:view`, so a
cashier could read every tenant sale by calling the URL directly.

The API now applies the same rule as the page:

| Caller | Result |
| --- | --- |
| `sale:view_history` (OWNER/MANAGER) | tenant-wide, filters honoured |
| `sale:view` only (CASHIER) | only rows where `cashierId = session.user.id`; a spoofed `cashierId` query param is replaced with the caller's id |
| no `sale:view` | `403 FORBIDDEN` |

`shiftId` / `status` filters are preserved, so the POS callers keep working:

- `CartPanel` held count: `?shiftId=<id>&status=OPEN&limit=1`
- `RetrieveHeldSalesSheet`: `?shiftId=<id>&status=OPEN&limit=50`
- `ShiftCloseModal` held count: `?shiftId=<id>&status=OPEN&limit=1`

These are the cashier's own shift queries, so the forced `cashierId` is exactly
the data they are allowed to see. The sale detail page/dialog continues to use
`getSaleById` with its own `sale:view_history` gate.

## Implementation

`src/lib/sales/sale-history-scope.ts`:

```ts
resolveSaleHistoryScope({ canViewSale, canViewSaleHistory, userId })
  -> { kind: 'tenant' } | { kind: 'cashier', cashierId } | { kind: 'forbidden' }

applySaleHistoryScope(filters, scope) // forces cashierId for the cashier scope
```

Both are pure and unit tested (`sale-history-scope.test.ts`).
