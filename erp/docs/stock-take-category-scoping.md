# Stock-take categories are tenant-scoped (ARGUS #209)

Creating a stock-take session accepted any `categoryId`. A foreign id created a
session whose category name was looked up without a tenant filter, leaking a
foreign category name into this tenant's list; an unknown id silently created an
empty session.

## Create route

`POST /api/store/stock-control/stock-takes` now:

1. Parses `categoryId` with `parseStockTakeCategoryId`
   (`src/lib/services/stockTakePolicy.core.ts`): missing/null/blank means "all
   categories"; a non-string is `400 VALIDATION_ERROR`.
2. Looks up the category with `stockTakeCategoryLookupWhere(tenantId, id)`,
   which always filters `tenantId` and `deletedAt: null`. A missing, deleted or
   foreign category returns `404 CATEGORY_NOT_FOUND` before the session is
   created.
3. Creates the session and its items only after that check.

A live category with no matching products is still allowed; the operator gets a
valid (empty) session for that category, which is a legitimate outcome.

## List route

The session list resolves category names with
`stockTakeCategoryListWhere(tenantId, ids)`, so the same tenant/deleted filter
applies. Even a legacy session with a foreign `categoryId` cannot display that
category's name.

Tests: `src/lib/services/__tests__/stockTakePolicy.core.test.ts`.
