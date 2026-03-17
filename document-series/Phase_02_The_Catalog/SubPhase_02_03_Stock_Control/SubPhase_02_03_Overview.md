# SubPhase 02.03 — Advanced Stock Control

## Metadata

| Field | Value |
|---|---|
| Sub-Phase ID | 02.03 |
| Sub-Phase Name | Advanced Stock Control |
| Parent Phase | Phase 02 — The Catalog |
| Status | Planned |
| Dependencies | SubPhase_02_01 complete, SubPhase_02_02 complete |
| Estimated Complexity | High |

---

## Objective

Build the complete stock management module for VelvetPOS. Once this sub-phase is complete, store staff can manually adjust inventory levels with full traceability, browse a complete movement history audit trail, conduct periodic stock take sessions, route completed sessions through an approval workflow that applies variance corrections in bulk, and view a real-time stock valuation summary. This sub-phase produces the full audit trail infrastructure that underpins inventory accuracy across the entire application lifecycle.

---

## Scope

### In Scope

- Stock Control landing page featuring four summary KPI widgets: total variants, total low-stock variant count, pending stock takes count, and total stock retail valuation (permission-gated).
- Manual Stock Adjustment form allowing a staff member to select a product and variant, specify an adjustment direction, quantity, reason enum value, and optional note.
- Stock Movement History full-page view with date range filtering, reason filtering, actor filtering, and CSV export.
- Stock Take session creation flow: scope selector (all catalog or a single category), session initialisation, auto-population of variants as session baseline items.
- Stock Take item counting interface supporting barcode scan input, SKU text lookup, count entry per variant, discrepancy auto-calculation, and recount flagging.
- Stock Take approval workflow: pending session list, discrepancy review tabbed view, approve action triggering bulk stock corrections, reject action with reason note, notification dispatch in both cases.
- Low Stock Alert widget: a reusable compact badge component shown on the landing page, inventory list header, and dashboard header, linking to the full low-stock list page.
- Low stock threshold notification: when an adjustment causes a variant to reach or drop below its lowStockThreshold, a toast is shown immediately and a NotificationRecord is persisted for all OWNER and MANAGER users of the tenant.
- Stock adjustment API routes: POST /api/stock/adjust and POST /api/stock/bulk-adjust.
- Stock take session API routes: GET and POST /api/stock-takes, GET /api/stock-takes/[id], POST /api/stock-takes/[id]/items, PATCH /api/stock-takes/[id]/items/[itemId], POST /api/stock-takes/[id]/complete, POST /api/stock-takes/[id]/approve, POST /api/stock-takes/[id]/reject.
- Stock history API route: GET /api/stock/movements.
- Stock valuation API route: GET /api/stock/valuation.
- Low stock API route: GET /api/stock/low-stock.
- Prisma seeder extension to add INITIAL_STOCK movement records for all variants seeded in SubPhase_02_01_12, ensuring the movement history has meaningful baseline data in the development environment.

### Out of Scope

- Purchase order-based stock receiving workflows (deferred to Phase 04).
- POS sale-triggered automatic stock deductions (Phase 03 — Point of Sale).
- Supplier return processing (Phase 04).
- Scheduled or automated stock alert delivery via email or WhatsApp (Phase 06).
- Stock demand forecasting or automated reorder suggestions (Phase 05 — Reports and Analytics).
- Multi-warehouse or multi-location stock tracking (not included in VelvetPOS v1 scope).

---

## Technical Context

All stock control UI routes live under the path /dashboard/[tenantSlug]/stock-control/. The espresso sidebar must mark "Stock Control" as active whenever the user is anywhere within this segment.

The data layer relies on models and service functions established in SubPhase_02_01. Specifically, the ProductVariant model carries stockQuantity, lowStockThreshold, sku, barcode, size, colour, retailPrice, and costPrice fields. The StockMovement model is an append-only audit log storing quantityBefore, quantityAfter, quantityDelta, reason (using the StockMovementReason enum), actorId, note, and createdAt. The StockTakeSession model tracks lifecycle status (IN_PROGRESS transitioning to PENDING_APPROVAL and then to APPROVED or REJECTED), an optional categoryId scope, the initiating user, the approving user, and timestamps for each phase boundary. StockTakeItem records tie sessions to variants, carrying systemQuantity captured at session start, countedQuantity entered by staff, a computed discrepancy, and an isRecounted flag.

The StockMovementReason enum contains these values: FOUND, DAMAGED, STOLEN, DATA_ERROR, RETURNED_TO_SUPPLIER, INITIAL_STOCK, SALE_RETURN, PURCHASE_RECEIVED, and STOCK_TAKE_ADJUSTMENT.

Service functions available in inventory.service.ts include adjustStock, bulkAdjustStock, getStockMovements, createStockTakeSession, addStockTakeItem, updateStockTakeItem, completeStockTakeSession, approveStockTake, rejectStockTake, getLowStockVariants, and getStockValuation.

RBAC permissions governing this sub-phase:

| Permission | Description |
|---|---|
| stock:view | View stock levels and movement history |
| stock:adjust | Perform manual stock adjustments |
| stock:take:manage | Create sessions and enter item counts |
| stock:take:approve | Approve or reject completed stock take sessions (OWNER and MANAGER roles only) |
| product:view_cost_price | View cost prices, which gates stock valuation visibility |

Standard UI patterns apply throughout: TanStack Query hooks for all data fetching, React Hook Form with Zod validation schemas for all forms, ShadCN Sonner for toast notifications, and skeleton placeholder components during loading states.

Design tokens in use: espresso (#3A2D28) for sidebar and primary buttons, terracotta (#A48374) for secondary accents and hover states, sand (#CBAD8D) for table headers and borders, mist (#D1C7BD) for input borders and dividers, linen (#EBE3DB) for page and card backgrounds, pearl (#F1EDE6) for content area surfaces. Semantic colours: success #2D6A4F, warning #B7791F for low stock states, danger #9B2226 for out-of-stock states, info #1D4E89 for neutral informational states. Typography: Playfair Display for all page headings, Inter for body UI text, JetBrains Mono for SKU codes, barcodes, and numeric stock values.

---

## Task List

| Task ID | Task Name | Estimated Complexity | Dependencies |
|---|---|---|---|
| Task_02_03_01 | Build Stock Control Page | Medium | SubPhase_02_01 complete, SubPhase_02_02 complete |
| Task_02_03_02 | Build Manual Stock Adjustment Form | Medium | Task_02_03_01 |
| Task_02_03_03 | Build Stock Movement History | Medium | Task_02_03_01 |
| Task_02_03_04 | Build Stock Take Session Flow | High | Task_02_03_01 |
| Task_02_03_05 | Build Stock Take Approval Workflow | High | Task_02_03_04 |
| Task_02_03_06 | Build Low Stock Alert Widget | Low | Task_02_03_01 |
| Task_02_03_07 | Implement Low Stock Threshold Notifications | Medium | Task_02_03_02 |
| Task_02_03_08 | Build Stock Adjustment API Routes | Medium | SubPhase_02_01 complete |
| Task_02_03_09 | Build Stock Take API Routes | High | SubPhase_02_01 complete |
| Task_02_03_10 | Build Stock Valuation View | Medium | Task_02_03_01 |
| Task_02_03_11 | Setup Stock Movement Audit Logging | Low | Task_02_03_08 |
| Task_02_03_12 | Seed Stock Levels For Sample Catalog | Low | SubPhase_02_01_12 complete |

---

## Validation Criteria

1. The Stock Control landing page displays accurate counts for total products, total variants, and total low-stock variants as derived from the live database state.
2. The manual adjustment form updates stockQuantity on the ProductVariant record in the database and creates a corresponding StockMovement record with correct quantityBefore, quantityAfter, and quantityDelta values.
3. Attempting to adjust a variant's stock below zero produces a client-side and server-side validation error and does not create any StockMovement record in the database.
4. The Stock Movement History page displays all movements for the tenant and correctly applies each filter in isolation and in combination, including date range, reason, product search, and actor.
5. A Stock Take session can be created scoped to a specific category, and the session is automatically pre-populated with all non-deleted variants belonging to that category at their current stock quantities.
6. All variants within an active Stock Take session can have a countedQuantity entered, either through the barcode scan input or by direct cell editing.
7. Attempting to complete a Stock Take session that has one or more variants without a countedQuantity entry displays a validation error and prevents the transition to PENDING_APPROVAL status.
8. Approving a Stock Take session triggers bulkAdjustStock for all items whose discrepancy is non-zero, and the resulting stock levels in the database reflect the approved counts.
9. Rejecting a Stock Take session makes no changes to any stock quantities and leaves all ProductVariant records unmodified.
10. The Low Stock Alert widget displays the correct count badge and navigates the user to the full low-stock list page when clicked.
11. The Stock Valuation page reports aggregate retail and cost values that can be manually verified by summing the seed data defined in SubPhase_02_01_12.
12. A NotificationRecord is created for all OWNER and MANAGER users when any stock adjustment causes a variant's quantity to fall to or below its lowStockThreshold.

---

## Files Created / Modified

All files listed below are new unless marked as modified. Paths are relative to the project root.

- src/app/dashboard/[tenantSlug]/stock-control/page.tsx — Stock Control landing page
- src/app/dashboard/[tenantSlug]/stock-control/adjust/page.tsx — Manual Adjustment form page
- src/app/dashboard/[tenantSlug]/stock-control/movements/page.tsx — Movement History page
- src/app/dashboard/[tenantSlug]/stock-control/stock-takes/page.tsx — Stock Take session list page
- src/app/dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/page.tsx — Active session counting interface
- src/app/dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/review/page.tsx — Approval review page
- src/app/dashboard/[tenantSlug]/stock-control/low-stock/page.tsx — Low Stock list page
- src/app/dashboard/[tenantSlug]/stock-control/valuation/page.tsx — Stock Valuation page
- src/app/api/stock/adjust/route.ts — POST stock adjustment API
- src/app/api/stock/bulk-adjust/route.ts — POST bulk adjustment API
- src/app/api/stock/movements/route.ts — GET movement history API
- src/app/api/stock/valuation/route.ts — GET stock valuation API
- src/app/api/stock/low-stock/route.ts — GET low stock variants API
- src/app/api/stock-takes/route.ts — GET list and POST create session API
- src/app/api/stock-takes/[id]/route.ts — GET single session API
- src/app/api/stock-takes/[id]/items/route.ts — POST add item API
- src/app/api/stock-takes/[id]/items/[itemId]/route.ts — PATCH update item count API
- src/app/api/stock-takes/[id]/complete/route.ts — POST complete session API
- src/app/api/stock-takes/[id]/approve/route.ts — POST approve session API
- src/app/api/stock-takes/[id]/reject/route.ts — POST reject session API
- src/app/api/notifications/route.ts — GET unread notifications API
- src/app/api/notifications/[id]/read/route.ts — PATCH mark one notification read API
- src/app/api/notifications/read-all/route.ts — PATCH mark all read API
- src/components/stock/LowStockAlertBadge.tsx — Reusable low stock indicator widget
- src/components/stock/StockKPICards.tsx — Landing page KPI card grid
- src/components/stock/StockMovementTable.tsx — Shared movement table component
- src/components/stock/StockTakeItemRow.tsx — Counting interface row component
- src/components/notifications/NotificationPopover.tsx — Bell icon notification popover
- src/hooks/useGetLowStockVariants.ts — TanStack Query hook for low stock data
- src/hooks/useGetStockMovements.ts — TanStack Query hook for movement history
- src/hooks/useGetStockTakes.ts — TanStack Query hook for session list
- src/hooks/useGetStockValuation.ts — TanStack Query hook for valuation data
- src/lib/audit.ts — Audit log helper (created if not already present)
- prisma/schema.prisma — Modified to add NotificationRecord model (if not already present from Phase 1)
- prisma/migrations/[timestamp]\_add\_notification\_records/ — Migration for NotificationRecord
- prisma/seed.ts — Modified to extend stock movement seeding
