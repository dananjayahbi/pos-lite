# 22 — Packaging Size (S/M/L) Dimension

**Module:** M7 — Office Packaging Inventory
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [23-packaging-lowstock-scan](./23-packaging-lowstock-scan.md)

## Issue / Current State
The `PackagingItem` model (`erp/prisma/schema.prisma`) has `category` (`PackagingCategory`: POLYMAILER, TAPE, LABEL, BUBBLE_WRAP, OTHER), `name`, `sku`, `unit`, and quantity fields — but no structured size or variant attribute. A polymailer size (S/M/L) can only be expressed through free-form text in the `name` field (e.g., "Polymailer S" vs "Polymailer M" as distinct string names).

The packaging UI (`erp/src/app/(store)/delivery/packaging/` — `PackagingPageClient.tsx` and `page.tsx`), the CRUD service `erp/src/lib/services/packaging.service.ts`, the validators (`erp/src/lib/validators/packaging.validators.ts`), and the API routes (`erp/src/app/api/store/packaging/route.ts` and `[id]/route.ts`) all treat size as free text or ignore it entirely. There is no consistent, filterable, or sortable size dimension.

## Impact
Free-text sizing leads to inconsistent naming, duplicate items ("Polymailer Small" vs "Polymailer S"), and prevents size-aware reporting, filtering, and per-size low-stock management. Staff cannot easily see which sizes are in stock or reorder intelligently. It also undermines reliable per-parcel consumption matching when a size must be selected at dispatch.

## Implementation Plan
### Step 1 — Add a structured size attribute to the data model
Add a `size` (or `variant`) attribute to `PackagingItem`, ideally as a string with optional enum values (S/M/L/XL) plus a free-text "custom" fallback, or a dedicated nullable enum scoped to packaging. Add the corresponding column/migration in `erp/prisma/schema.prisma`. Make it optional at first so existing records migrate cleanly.

### Step 2 — Backfill and normalize existing names
Write a data backfill that parses existing free-text `name` values (e.g., trailing "S/M/L") into the new `size` attribute where recognizable, leaving truly custom names as-is. Add a uniqueness consideration so the same item + size + category does not silently duplicate.

### Step 3 — Update the service and validators
Extend `createPackagingItem` and `updatePackagingItem` in `erp/src/lib/services/packaging.service.ts` to accept and persist `size`. Update `erp/src/lib/validators/packaging.validators.ts` (create/update input schemas) with the new optional field and allowed values.

### Step 4 — Update the API routes
Extend `erp/src/app/api/store/packaging/route.ts` and `[id]/route.ts` to accept, validate, and return the `size` field, and optionally to filter the list by size.

### Step 5 — Update the packaging UI
In `PackagingPageClient.tsx`, add a size field to the create/edit form (a select for standard sizes plus a free-text option), display size as a first-class column/tag in the inventory table, and optionally allow filtering/sorting by size. Keep the change backward-compatible so items without a size still render.

## Dependencies
- [23-packaging-lowstock-scan](./23-packaging-lowstock-scan.md) — per-size awareness will make the low-stock scan more useful but is not required for it.
- Existing `PackagingCategory` and `PackagingUnit` enums in the schema.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `PackagingItem.size`, migration.
- `erp/src/lib/services/packaging.service.ts` — create/update functions.
- `erp/src/lib/validators/packaging.validators.ts` — input schemas.
- `erp/src/app/api/store/packaging/route.ts`, `[id]/route.ts` — API field handling/filtering.
- `erp/src/app/(store)/delivery/packaging/PackagingPageClient.tsx` — form field, table column, filter.
