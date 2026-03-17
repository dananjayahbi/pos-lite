# SubPhase 03.01 — POS Core

## Metadata

| Field | Value |
|---|---|
| Sub-Phase ID | 03.01 |
| Sub-Phase Name | POS Core |
| Parent Phase | Phase 03 — The Terminal |
| Status | Pending |
| Dependencies | Phase 01 fully complete, Phase 02 fully complete |
| Estimated Tasks | 12 |

## Objective

Establish all data models for the POS terminal, build the sale and shift service layers, and construct the complete POS terminal UI with product grid, cart management, discounts, hold/retrieve, barcode scanning, and shift open/close flow. This sub-phase delivers a fully functional cashier workstation capable of processing a sale from initial product selection through to a completed, auditable transaction record with atomic inventory deduction. By the end of this sub-phase the cashier can open a shift, browse and search products, build a cart, apply discounts (with manager authorisation where required), place transactions on hold, retrieve held transactions, scan barcodes, complete a sale, and close their shift with a full cash reconciliation summary.

## Scope

### In Scope

- Sale, SaleLine, Shift, and ShiftClosure Prisma models
- StockMovementReason.SALE and StockMovementReason.VOID_REVERSAL enum value additions
- Database migrations: "add_sale_and_saleline_models" and "add_shift_and_closure_models"
- sale.service.ts implementing createSale (with atomic stock deduction inside a single Prisma interactive transaction), getSaleById, getSales with full pagination and filtering, voidSale with stock restoration and audit log entry, and getShiftSales with aggregated totals
- shift.service.ts implementing openShift, closeShift (with automatic voiding of lingering held sales), getCurrentShift, getShiftById, and getShifts
- POS terminal special layout — no sidebar, no top navigation bar — at src/app/dashboard/[tenantSlug]/pos/layout.tsx
- POS terminal page at src/app/dashboard/[tenantSlug]/pos/page.tsx
- ProductGrid component with category filter tabs and product card tiles (auto-fill CSS grid, 130px minimum tile width)
- POS product search with 200ms debounce and client-side filtering from TanStack Query cache; automatic API-mode switch for catalogs with more than 500 products
- VariantSelectionModal presenting a size-colour matrix for multi-variant products, collapsing to a flat chip row for single-axis variants
- CartPanel component with scrollable line items list, discount area, totals section, and action buttons
- LineItemDiscountControl with percentage/fixed-amount mode toggle and live preview
- CartDiscountControl with cart-level discount percentage/fixed input
- CartManagerPINModal with a numeric keypad layout for authorising discount overrides
- useCartStore Zustand store with decimal.js arithmetic; all computed values (subtotal, taxAmount, totalAmount) derived from the items array rather than stored separately
- HoldSaleButton and RetrieveHeldSalesSheet
- useBarcodeScanner custom React hook wrapping a window-level keydown listener with 50ms inter-keystroke timing detection
- ShiftOpenModal (shown fullscreen when no open shift exists) and ShiftCloseModal
- Sale History page at /dashboard/[tenantSlug]/pos/history with table, filters, void action, and sale detail modal
- Zod validators for sale creation (CreateSaleSchema) and shift operations (OpenShiftSchema, CloseShiftSchema)
- Sale API routes: GET /api/sales (paginated list), POST /api/sales (create), GET /api/sales/[id], POST /api/sales/[id]/void
- Shift API routes: GET /api/shifts, POST /api/shifts (open), POST /api/shifts/[id]/close

### Out of Scope

- Payment modals (CASH change calculation flow, CARD terminal integration, SPLIT payment entry) — deferred to SubPhase 03.02
- WhatsApp receipt delivery and thermal printer integration — deferred to SubPhase 03.02
- Offline mode, service worker caching, and background sync — deferred to SubPhase 03.02
- Returns and exchanges — deferred to SubPhase 03.03
- Customer lookup, loyalty points, and customer-facing display — deferred to Phase 04
- Reporting dashboards and sales analytics — deferred to Phase 05

## Technical Context

### Data Architecture

The POS terminal operates entirely within the tenant boundary enforced by the tenantId field present on every data model. All database queries must include a tenantId filter to prevent cross-tenant data leakage. The Sale record is the central document of a transaction: it links the cashier (User), the shift (Shift), all line items (SaleLine), and the optionally authorising manager (User) into a single auditable record.

The lifecycle of a sale follows a clear state machine. A Sale begins as OPEN when it is placed on hold — this is a pure cart snapshot with no inventory impact. It transitions to COMPLETED when payment is accepted and stock has been deducted. It is marked VOIDED when reversed by a manager within the same open shift, at which point all stock is restored. Only COMPLETED sales result in stock being adjusted via adjustStock; the OPEN state reserves nothing in inventory.

### Monetary Precision

All monetary fields in Prisma are declared as Decimal(12,2). On the application layer, all arithmetic uses the decimal.js library to avoid the floating-point rounding errors that are unacceptable in a financial system. Cart totals are rounded to two decimal places using ROUND_HALF_UP semantics. Subtotals, discount amounts, tax amounts, and totals must all be consistently derived from the same decimal pipeline to ensure the database record exactly matches what the cashier sees on screen at every stage of the transaction.

### Tax Calculation Model

Tax in VelvetPOS is computed at the line level because different products within the same cart can carry different tax rules. A product's tax rule — STANDARD_VAT at 15%, SSCL at 2.5%, or EXEMPT at 0% — is resolved from the Product model and applied to the line's after-discount amount. The Sale.taxAmount field stores the sum of all per-line taxes. This per-line approach ensures accuracy when a single transaction mixes taxable and tax-exempt items, which is common in a clothing store selling both garments and imported accessories.

### Discount Authorisation Model

The discount system enforces a threshold-based authorisation flow aligned with RBAC roles. CASHIER role users may apply up to 10% on a single line item and up to 5% at the cart level without additional approval. Any discount above those thresholds triggers the CartManagerPINModal. The verifying manager's userId is recorded in Sale.authorizingManagerId, creating an immutable chain of accountability linking every discounted transaction to the specific manager who approved it. MANAGER and OWNER roles bypass all thresholds and never see the PIN modal.

### Shift Management

A shift is a work period opened by a cashier before any POS activity can begin. The POS terminal layout enforces this by redirecting to the ShiftOpenModal if no OPEN shift exists for the authenticated user. All sales belong to a shift via the shiftId foreign key. At shift close, the ShiftClosure record calculates and persists the expected cash, the actual cash counted, and the resulting discrepancy — this record is immutable after creation and serves as the end-of-shift cash reconciliation document.

### Service Integration

The sale.service.ts and shift.service.ts layers depend on the existing services from Phase 2. Specifically, adjustStock from inventory.service.ts is called inside the same Prisma interactive transaction as sale creation, ensuring atomicity: either the entire sale is committed, all SaleLines are written, and all stock movements are applied, or everything is rolled back together with no partial state left in the database.

## Task List

| Task ID | Task Name | Complexity | Dependency |
|---|---|---|---|
| Task_03_01_01 | Create_Sale_And_SaleLine_Models | Low | Phase 02 complete |
| Task_03_01_02 | Create_Shift_And_ShiftClosure_Models | Low | Task_03_01_01 |
| Task_03_01_03 | Build_Sale_Service_Layer | High | Task_03_01_02 |
| Task_03_01_04 | Build_Shift_Service_Layer | Medium | Task_03_01_02 |
| Task_03_01_05 | Build_POS_Terminal_Layout | Medium | Task_03_01_04 |
| Task_03_01_06 | Build_Product_Grid_And_Category_Navigation | Medium | Task_03_01_05 |
| Task_03_01_07 | Build_Variant_Selection_Modal | Medium | Task_03_01_06 |
| Task_03_01_08 | Build_Cart_Panel | High | Task_03_01_05 |
| Task_03_01_09 | Build_Discount_System | High | Task_03_01_08 |
| Task_03_01_10 | Build_Hold_And_Retrieve_Sales | Medium | Task_03_01_08 |
| Task_03_01_11 | Build_POS_Barcode_Scanner_Integration | Medium | Task_03_01_07 |
| Task_03_01_12 | Build_Sale_History_Page | Medium | Task_03_01_03 |

## Validation Criteria

- Sale and Shift models migrate without errors on a fresh database after running both migration commands in sequence
- Opening a shift inserts a Shift record with status OPEN; attempting to open a second OPEN shift for the same cashier in the same tenant throws a ConflictError
- The POS terminal at /dashboard/[tenantSlug]/pos redirects to the ShiftOpenModal when the authenticated cashier has no open shift, and loads the full terminal UI otherwise
- All active, non-archived products and their variants are loaded into the TanStack Query cache on terminal open, and rendered as product card tiles in the grid
- Clicking a category tab filters the product grid to show only products from that category
- Clicking a multi-variant product tile opens the VariantSelectionModal with the size-colour matrix populated with correct stock levels for each cell
- Clicking a single-variant product tile adds it directly to the CartPanel without a modal
- Selecting a variant in the modal adds it to the cart, or increments quantity if it is already present
- Scanning a barcode (simulated by typing a barcode string at machine speed followed by Enter) adds the correct variant to the cart and shows a green flash notification
- Applying a line item discount at or below 10% for a CASHIER completes without a PIN prompt; exceeding 10% shows the CartManagerPINModal
- Applying a cart discount at or below 5% completes without a PIN prompt; exceeding 5% shows the CartManagerPINModal with successful entry recording authorizingManagerId in the store
- Holding a sale saves it as an OPEN Sale record with all SaleLines, clears the terminal cart, and shows a toast with the short reference ID
- Retrieving a held sale loads its lines back into the CartPanel; the sale's OPEN status is preserved until payment completes
- Closing a shift with no OPEN (held) sales creates a ShiftClosure record with correct totals and transitions the Shift to CLOSED
- Any OPEN Sale records at the time of shift close are automatically marked VOIDED with the note "No-sale — shift closed"

## Files Created / Modified

| File Path | Action |
|---|---|
| prisma/schema.prisma | Modified — Sale, SaleLine, Shift, ShiftClosure added; PaymentMethod, SaleStatus, ShiftStatus enums added; StockMovementReason updated |
| prisma/migrations/[ts]_add_sale_and_saleline_models/ | Created |
| prisma/migrations/[ts]_add_shift_and_closure_models/ | Created |
| src/lib/services/sale.service.ts | Created |
| src/lib/services/shift.service.ts | Created |
| src/lib/validators/sale.validator.ts | Created |
| src/lib/validators/shift.validator.ts | Created |
| src/app/dashboard/[tenantSlug]/pos/layout.tsx | Created |
| src/app/dashboard/[tenantSlug]/pos/page.tsx | Created |
| src/app/dashboard/[tenantSlug]/pos/history/page.tsx | Created |
| src/app/api/sales/route.ts | Created |
| src/app/api/sales/[id]/route.ts | Created |
| src/app/api/sales/[id]/void/route.ts | Created |
| src/app/api/shifts/route.ts | Created |
| src/app/api/shifts/[id]/close/route.ts | Created |
| src/components/pos/ProductGrid.tsx | Created |
| src/components/pos/ProductCard.tsx | Created |
| src/components/pos/CategoryTabs.tsx | Created |
| src/components/pos/VariantSelectionModal.tsx | Created |
| src/components/pos/CartPanel.tsx | Created |
| src/components/pos/CartLineItem.tsx | Created |
| src/components/pos/LineItemDiscountControl.tsx | Created |
| src/components/pos/CartDiscountControl.tsx | Created |
| src/components/pos/CartManagerPINModal.tsx | Created |
| src/components/pos/HoldSaleButton.tsx | Created |
| src/components/pos/RetrieveHeldSalesSheet.tsx | Created |
| src/components/pos/ShiftOpenModal.tsx | Created |
| src/components/pos/ShiftCloseModal.tsx | Created |
| src/components/pos/SaleHistoryTable.tsx | Created |
| src/components/pos/SaleDetailModal.tsx | Created |
| src/hooks/useBarcodeScanner.ts | Created |
| src/stores/cartStore.ts | Created |
