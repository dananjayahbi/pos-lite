# Stock valuation uses one permission gate (ARGUS #185)

The valuation API (`GET /api/store/stock-control/valuation`) has always required
`stock:valuation:view`. The page and the Stock Control "Total Stock Value" card
instead checked `product:view_cost_price`, which `STOCK_CLERK` holds for product
editing. A stock clerk therefore saw the card and could open the page, only for
the page to render KPI shells and then hit the API's 403.

## Resolution

The dedicated `stock:valuation:view` key is the intended gate:

- `OWNER` and `MANAGER` inherit it from the role matrix.
- `STOCK_CLERK` has `product:view_cost_price` but not the valuation key.
- `CASHIER`, `DISPATCH_STAFF` and `FACTORY_MANAGER` have neither.

All valuation surfaces now reference `PERMISSIONS.STOCK.viewStockValuation`:

- `src/components/stock-control/StockValuationClient.tsx` renders the normal
  "Access Restricted" card before any valuation UI.
- `src/components/stock-control/StockControlDashboard.tsx` shows the "Restricted"
  lock on the Total Stock Value card.
- `src/components/dashboard/StockSummaryWidgets.tsx` does the same for the
  dashboard Inventory Retail Value widget.
- The API route keeps its server-side check and `COST_PRICE_RESTRICTED` 403.

Tests: `src/lib/__tests__/stock-valuation-permission.test.ts` pins the role facts
and the shared gate on every surface.
