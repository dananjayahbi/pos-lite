# Phase 03 — The Terminal

## Metadata

| Attribute        | Details                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| **Phase**        | Phase 03                                                                 |
| **Codename**     | The Terminal                                                             |
| **Status**       | Not Started                                                              |
| **Preceded By**  | Phase 02 — The Catalog                                                   |
| **Followed By**  | Phase 04 — The Operations                                                |
| **Dependencies** | Phase 02 complete — all products, variants, and stock levels established |

---

## Phase Goal

Phase 3 transforms VelvetPOS from an inventory management system into a fully operational point-of-sale software. The goal is to deliver a complete, production-ready POS terminal that a cashier can use to open a shift, process sales from start to finish, handle payments in multiple forms, dispatch e-receipts, and close the shift — all from a single touch-optimised browser screen.

This phase also delivers the full returns and exchanges workflow, enabling store managers to process refunds, item exchanges, and credit notes against completed sales. By the end of Phase 3, the core revenue cycle of the store is fully operational in VelvetPOS.

---

## Key Deliverables

1. Touch-friendly POS terminal interface at a dedicated full-screen route
2. Product grid with category drill-down navigation
3. Real-time product search by name or SKU within the terminal
4. Barcode scanning integration — hardware scanner input captured via keyboard listener
5. Variant selection modal for products with multiple size/colour options
6. Cart panel with line items, quantities, pricing, and sub-totals
7. Line-item-level discount (percentage or fixed amount) with role-based permission enforcement
8. Cart-level discount with Manager PIN override for amounts beyond the CASHIER threshold
9. Hold sale and retrieve held sale functionality for multi-queue cashier stations
10. Sale data model covering all required financial and audit fields
11. Shift open and close flow with opening float entry and closing cash count
12. Cash payment modal with change calculation
13. Card payment modal with terminal reference number capture
14. Split payment support (cash + card in one transaction)
15. Payment completion and sale finalisation with automatic stock deduction via adjustStock
16. WhatsApp e-receipt dispatch using the Meta Cloud API
17. Thermal receipt print layout formatted for 80mm paper (ESC/POS-compatible HTML/CSS)
18. Sale history page with filters, reprint capability, and voiding (same-shift only)
19. Offline mode: cart state persisted to IndexedDB, sale submitted when connectivity resumes
20. Full return workflow — search completed sale, select items to return, choose refund method
21. Exchange workflow — return selected items and immediately add replacement items to a new cart
22. Inventory restock toggle on returns (restores stockQuantity via adjustStock)
23. Manager PIN authorisation modal for restricted actions (overriding discounts, processing returns)
24. Return receipt dispatch via WhatsApp and thermal print
25. Z-report / shift summary generated at shift close with cash, card, and return breakdowns
26. Sale API routes: POST /api/sales, GET /api/sales, GET /api/sales/[id], PATCH /api/sales/[id]/void
27. Return API routes: POST /api/returns, GET /api/returns, GET /api/returns/[id]
28. Shift API routes: POST /api/shifts, POST /api/shifts/[id]/close, GET /api/shifts/current

---

## Sub-Phase Breakdown

### SubPhase 03.01 — POS Core

The first sub-phase lays the data models and constructs the entire POS terminal UI with cart management. It establishes the Sale, SaleLine, Shift, and ShiftClosure Prisma models, the sale service layer responsible for creating sales and deducting stock, and the full terminal screen with its product grid, search, variant modal, cart, discount system, hold/retrieve flow, and shift management. All sub-phases of Phase 3 depend on this sub-phase being complete.

### SubPhase 03.02 — Payments, Receipts & Offline Mode

The second sub-phase adds the payment modals (cash, card, split), completes the sale API routes, integrates WhatsApp receipt dispatch and thermal receipt printing, builds the sale history page, and implements offline cart persistence using IndexedDB. This sub-phase connects the terminal UI to the financial backend and ensures a sale can be completed end-to-end.

### SubPhase 03.03 — Returns & Exchanges

The third sub-phase builds the complete returns and exchanges workflow. It adds the Return and ReturnLine data models, the return service, the return initiation page, refund options, the exchange flow, the return API routes, the Manager authorisation modal for restricted POS operations, return receipts, the Z-report at shift close, and demo return seeding. Returns are the most complex post-sale operation in a retail POS; correctness and audit trail completeness are paramount.

---

## Technical Foundations

### POS Terminal Architecture

The POS terminal is a dedicated full-screen route at `/dashboard/[tenantSlug]/pos`. This route uses a special layout that hides the standard sidebar and dashboard navigation to provide a distraction-free, touch-optimised cashier interface. The layout consists of two primary panels: the left product panel (product grid/search/category navigation) and the right cart panel.

The terminal runs as a highly reactive client component with minimal server round-trips during an active session. Product data (from Phase 2) is pre-fetched and hydrated via TanStack Query on terminal open — the product grid is rendered from the local cache. Cart state lives in a Zustand cart store (`useCartStore`). The only real-time API calls during a transaction are the final sale creation POST and any Manager PIN verification calls.

### Sale and Financial Data Models

The Sale model records every completed transaction. Key fields include: tenantId, shiftId, cashierId, subtotal, discountAmount (cart-level), taxAmount, totalAmount, changeGiven (for cash), paymentMethod (CASH, CARD, SPLIT), status (OPEN — in progress, COMPLETED, VOIDED), voidedById and voidedAt, whatsappReceiptSentAt, createdAt, completedAt. Monetary fields are Decimal(12,2).

The SaleLine model records each line item: saleId, variantId, productName (snapshot), variantDescription (snapshot of size/colour), quantity, unitPrice, discountPercent, discountAmount, lineTotalBeforeDiscount, lineTotalAfterDiscount. Snapshots of product name and variant description are essential for historical fidelity — if the product is later renamed or deleted, the sale record must still show the correct information.

The Shift model captures cashier sessions: tenantId, cashierId, openedAt, closedAt, openingFloat (Decimal), closingCashCount (Decimal), expectedCash (computed), cashDifference, totalSales, totalReturns, totalCash, totalCard, status (OPEN, CLOSED).

### Discount Permission System

Three discount tiers are enforced at the POS:
- CASHIER may apply a line-item discount up to 10% without authorisation
- CASHIER may apply a cart-level discount up to 5% without authorisation
- Beyond these thresholds, a Manager PIN modal is required — the MANAGER or OWNER enters their PIN to authorise the override, and the authorising user's ID is recorded on the sale

The discount thresholds are stored as tenant settings (defined in Phase 4 store settings) but are hard-coded to the above defaults for Phase 3.

### Stock Deduction on Sale

When a sale is completed (`POST /api/sales`), the sale service calls `adjustStock` from Phase 2's inventory service for each SaleLine variant, with reason `SALE` (a new StockMovementReason value: SALE — added to the enum in Phase 3). This call is wrapped in the same Prisma transaction as the sale creation itself, ensuring atomicity: either the sale is recorded AND stock is deducted, or neither operation is persisted.

If the store's `allowNegativeStock` setting is enabled (default: disabled), the adjustStock validation for negative stock is bypassed. This is a tenant-level setting stored in the Tenant model.

### WhatsApp Receipt Integration

WhatsApp dispatch uses the Meta Cloud API (not Twilio). The tenant must configure `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and the Template name in their settings. Receipts are sent via the `send_message` endpoint using a pre-approved message template. The body variables are formatted dynamically from the sale data. A failed dispatch is silently logged (not an error that blocks sale completion) — the `whatsappReceiptSentAt` field is only set on confirmed delivery.

### Thermal Receipt Format

The thermal receipt is an HTML template rendered in a server component and accessible as a print URL: `/api/sales/[id]/receipt`. The HTML uses `@media print` CSS to render in 80mm (56-character) receipt format with ESC/POS-style line spacing. The cashier can send this to the browser's print dialog for a physical 80mm thermal printer.

### Offline Mode

Cart state and the queued sale payload are persisted to `IndexedDB` via the `idb` library every time the cart changes. On connectivity loss, the "Submit Sale" button enters an "Offline — will sync when online" state. When connectivity resumes, the queued payload is automatically submitted. The offline queue holds at most one pending sale at a time per terminal (simplification for Phase 3 — multi-queue offline support is a Phase 5 feature).

### Return Workflow

Returns are initiated from the Sale History page. The return service:
1. Looks up the original sale
2. Validates return eligibility (not already fully returned, within return window — configurable, default 30 days)
3. Creates a Return record and ReturnLine records
4. Optionally calls adjustStock with reason SALE_RETURN for each returned item (only if `restockItems` is true)
5. Creates a refund record linked to the original payment method

Return authorisation: returns always require a Manager PIN confirmation, regardless of amount.

---

## Phase Constraints

1. **No multi-location/multi-register.** Phase 3 supports one active POS terminal per tenant. Queue management across multiple concurrent registers is a Phase 4 enhancement.
2. **No PayHere integration at the POS.** Card payments in Phase 3 capture a manual terminal reference number only. Full card gateway integration via PayHere is Phase 5.
3. **No customer account linking at POS.** Customer lookup and loyalty points integration belongs to Phase 4 CRM.
4. **No promotions engine.** Automated discount rules (BOGO, scheduled sales, promo codes) are Phase 4. Manual discounts at Phase 3.
5. **No purchase order receiving via POS.** That is Phase 4 Operations.
6. **Void is same-shift only.** A completed sale can only be voided within the same open shift. Cross-shift voids require a return workflow.

---

## Dependencies

| Dependency                              | Provided By             |
| --------------------------------------- | ----------------------- |
| ProductVariant model and barcode index  | Phase 02.01             |
| adjustStock / StockMovement service     | Phase 02.01             |
| Tenant and User models                  | Phase 01.03 / 01.02     |
| RBAC permission system                  | Phase 01.02             |
| Session management (NextAuth)           | Phase 01.02             |
| AuditLog service                        | Phase 01.02             |
| WhatsApp Meta Cloud API credentials     | Environment config      |
| Design system tokens and layout shell   | Phase 01.01             |

---

## Exit Criteria

- [ ] A CASHIER can open a shift with a defined opening float
- [ ] The POS product grid renders all active, non-archived products from the catalog
- [ ] Barcode scan adds the correct variant to the cart
- [ ] Selecting a product with multiple variants opens the variant selection modal
- [ ] A line-item discount is applied and reflected in the cart sub-total
- [ ] A cart-level discount beyond the CASHIER threshold requires and records a Manager PIN
- [ ] A sale can be placed on hold and retrieved
- [ ] Cash payment calculates correct change and completes the sale
- [ ] Card payment records a terminal reference number and completes the sale
- [ ] Split payment allocates amounts across cash and card correctly
- [ ] Sale completion deducts stock for all SaleLine variants via StockMovement records
- [ ] WhatsApp receipt is dispatched to the customer's phone number (sandbox test accepted)
- [ ] Thermal receipt HTML renders correctly at 80mm width in the browser print preview
- [ ] Sale history page shows all completed sales with correct totals
- [ ] A completed sale can be voided within the same shift with an audit record
- [ ] A return can be processed for partial or full items from a completed sale
- [ ] Restock toggle on return creates corresponding StockMovement records
- [ ] Manager PIN modal blocks and records authorisation for restricted operations
- [ ] Shift close generates a Z-report summary with cash, card, and return totals
- [ ] Cart state survives a browser refresh via IndexedDB persistence

---

## What Is NOT In This Phase

| Feature                              | Deferred To                  |
| ------------------------------------ | ---------------------------- |
| Customer account lookup at POS       | Phase 04 — CRM               |
| Promotions / promo codes at POS      | Phase 04 — Promotions Engine |
| PayHere card gateway integration     | Phase 05 — Billing           |
| Multi-register / concurrency control | Phase 04 — Operations        |
| Purchase order goods receiving       | Phase 04 — Operations        |
| Full-featured reports (sales P&L)    | Phase 05 — Reporting         |
| Automated WhatsApp marketing blasts  | Phase 04 — CRM               |
| Customer Facing Display (CFD)        | Phase 04 — Hardware          |
