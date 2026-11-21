# Inventory status badges (ARGUS #149)

The **Deleted** inventory view (`?status=deleted`) lists soft-deleted products.
Its rows used to show the normal stock badge, so all 37 deleted products read
**Low Stock** / **Active**.

`resolveProductStatusBadge` in `src/lib/inventory/stockState.ts` resolves the
badge in lifecycle order:

1. soft-deleted row -> **Deleted**
2. archived row -> **Archived**
3. otherwise the shared stock rule -> **Out of Stock** / **Low Stock** / **Active**

`InventoryTable` passes the Deleted-view flag to `ProductStatusBadge`, so the
badge matches the action set (Restore instead of Archive/Delete).
`src/lib/inventory/__tests__/stockState.test.ts` covers deleted rows with low
and zero stock, deleted+archived precedence, and live-row badges.
