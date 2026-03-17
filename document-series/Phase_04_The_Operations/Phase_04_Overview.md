# Phase 04 — The Operations

## Metadata

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Phase Number        | 04                                                                                          |
| Codename            | The Operations                                                                              |
| Status              | Not Started                                                                                 |
| Depends On          | Phase 03 complete (POS terminal fully functional with sale history data)                    |
| Unlocks             | Phase 05 — The Platform (analytics and billing)                                             |
| Sub-Phases          | SubPhase_04_01 CRM and Supplier Management, SubPhase_04_02 Staff Promotions and Expenses, SubPhase_04_03 Hardware Integrations and Audit |

---

## Phase Goal

Transform VelvetPOS from a transactional POS system into a fully operational boutique management platform. Phase 04 delivers every operational management module that sits beyond the terminal: a Customer Relationship Management (CRM) system to track buyer history and automate engagement, a supplier and purchase order system to manage inventory replenishment, a staff management system with commissions and time clocking, a promotions engine for automated discounts, an expense logger, and hardware integrations that connect VelvetPOS to physical retail devices.

By the end of Phase 04, the store owner has a complete picture of their operations — not just what was sold today, but who bought it, who sold it, where the stock came from, what it cost, and how the business is performing against its expenses.

---

## Key Deliverables

### CRM and Customer Management
- Customer model with full profile: name, phone, email, gender, birthday, tags, notes, credit balance, LTV
- Customer creation and editing within the POS terminal (link customer to sale at checkout)
- Customer detail page with full purchase history, return history, outstanding credit/debt, and LTV display
- Customer search and filtering (by name, phone, tags, spend band)
- Store credit redemption at POS checkout (consuming StoreCredit records from Phase 03)
- WhatsApp birthday greeting automation — triggered daily via a cron-style scheduled task
- Marketing broadcast builder — compose and send a WhatsApp message to all customers matching a filter
- Customer import via CSV
- Customer tagging (VIP, Wholesale, Regular)

### Supplier and Purchase Order System
- Supplier model: name, contact, phone, WhatsApp number, address, lead time days, notes
- Supplier CRUD management page
- Purchase order (PO) creation: select supplier, add product variants with quantity and expected cost price, set expected delivery date
- PO WhatsApp dispatch — send PO as a formatted WhatsApp message to the supplier's number
- Goods Receiving workflow: mark a PO as received, review each line (actual qty received vs ordered), trigger stock update (atomic adjustStock with reason PURCHASE_RECEIVED)
- Cost price update prompt: when received cost differs from the variant's current cost price, prompt the Manager to update
- PO history list with status tracking (DRAFT, SENT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED)
- PO detail view with line-item status

### Staff Management
- Staff profile creation and editing (name, email, role assignment, PIN setup, commission rate %)
- Staff list page with active/inactive filter
- PIN management — Managers and Owners can set or reset a staff member's PIN
- Commission rate per staff member — fixed percentage of net sales they process
- Commission report — period-selectable report of sales by salesperson with commission amounts
- Payout tracking — mark commissions as paid per staff member per period
- Time clock — staff clock-in and clock-out with shift-linked time records
- Time clock report per staff member per period

### Promotions Engine
- Promotion types supported: Percentage discount (whole cart), Fixed amount off (whole cart), Percentage discount on a specific category, Buy-One-Get-One (BOGO), Mix-and-match (e.g., any 3 items for Rs. X), Promo code entry at POS checkout
- Promotion schedule: start date, end date, active toggle
- Customer-specific pricing: override retail price for a tagged customer group (e.g., Wholesale pricing)
- Promotion management UI: create, edit, archive promotions
- POS terminal integration: auto-apply eligible promotions at cart calculation time, show applied promotion label on cart line

### Expenses
- Expense logger: category, amount, description, receipt image upload, date, recorded by (User)
- Expense categories (customizable): Rent, Salaries, Utilities, Advertising, Maintenance, Miscellaneous
- Expense list page with date filter and category filter
- Cash flow statement view: income (from completed sales) vs expenses (from expense log) for a date range
- Shift petty cash: record petty cash withdrawals from the till within an open shift (CashMovement with reason PETTY_CASH)

### Hardware Integrations
- Thermal printer ESC/POS integration: connect to a network or USB thermal printer to print receipts and Z-Reports directly without browser print dialog
- Cash drawer kick: send a cash drawer open signal via the thermal printer interface on Cash and CASH_REFUND transactions
- Customer Facing Display (CFD) support: a second-screen display route (`/cfd`) showing the current cart items and total, updating in real time via server-sent events or a Zustand broadcast
- Hardware settings page: configure printer IP/port/type, cash drawer toggle, CFD screen toggle
- Test hardware buttons: "Test Print" and "Test Drawer" for configuration verification

---

## Sub-Phase Breakdown

### SubPhase_04_01 — CRM and Supplier Management

Covers the full Customer model, customer pages, CRM actions, store credit redemption at POS, WhatsApp birthday and broadcast features, and the complete supplier and purchase order system.

Key new models: Customer (full profile), Supplier, PurchaseOrder, PurchaseOrderLine.
Key services: customer.service.ts, supplier.service.ts, purchaseOrder.service.ts.
Key UI: Customer list, Customer detail, Supplier list, PO list, PO create wizard, Goods Receiving modal.

### SubPhase_04_02 — Staff, Promotions and Expenses

Covers staff profile management, PIN setup, commission tracking, payout reports, time clock, the full promotions engine, expense logging, petty cash, and the cash flow statement.

Key new models: CommissionRecord, CommissionPayout, TimeClock, Promotion, PromotionRule, Expense, CashMovement (extend from Phase 03 Shift).
Key services: commission.service.ts, promotion.service.ts, expense.service.ts.
Key UI: Staff list, Staff detail with commission tab, Promotions list with rule builder, Expense list, Cash Flow view.

### SubPhase_04_03 — Hardware Integrations and Audit

Covers thermal printer ESC/POS integration, cash drawer kick, Customer Facing Display, hardware settings, and a comprehensive audit log viewer for all business-critical mutations.

Key new infrastructure: src/lib/hardware/printer.ts, src/lib/hardware/cashDrawer.ts, src/app/dashboard/[tenantSlug]/cfd/page.tsx.
Key services: audit.service.ts (build on existing AuditLog model from Phase 01).
Key UI: Hardware settings page, CFD display route, Audit log viewer with filtering.

---

## Technical Foundations

### Customer Model Design

The full Customer model is introduced in Phase 04. A stub `customerId` nullable FK already exists on `Sale` from Phase 03 (via the overview documentation). In Phase 04 the Customer table is created and the FK relation is fully wired. Key design decisions:

- `creditBalance` stores the customer's financial balance with the store. Positive = store owes customer (store credit). Negative = customer owes store (tab/debt). This replaces the separate StoreCredit model from Phase 03 — StoreCredit records are migrated into Customer.creditBalance on first Phase 04 migration for any customer-linked credits (or remain orphaned for anonymous credits).
- `totalSpend` is maintained as a running total updated on each Sale completion and Return completion. It is not recomputed from scratch on each request.
- `birthday` enables birthday automation without a full CRM events system.

### Purchase Order and Stock-Receiving Design

POs contain a snapshot of the expected cost price at order time (`PurchaseOrderLine.expectedCostPrice`). When goods are received, the Manager is shown each line with the actual received quantity and prompted to enter the actual cost price if it differs. If confirmed, `ProductVariant.costPrice` is updated. Stock is adjusted via `adjustStock(variantId, delta, PURCHASE_RECEIVED)` inside a transaction that also marks the PO line as received.

Partial receiving is supported: a PO can be partially received across multiple receiving sessions. The PO status transitions: DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED.

### Promotions Engine Design

Promotions are evaluated at cart-calculation time, not at item-add time. The POS terminal's cart total computation calls `promotion.service.evaluatePromotions(tenantId, cartLines, customerId)` which returns a list of applied discounts. Each applied discount carries a `promotionId`, a `discountAmount`, and a human-readable `label` (e.g., "Summer Sale — 15% off"). Applied promotions are stored as a JSON array in `Sale.appliedPromotions` (a new field on Sale).

The promotions engine evaluates rules in this priority order: customer-specific pricing first, then category promotions, then BOGO, then cart-level discounts. Promo codes are validated at entry and add a promo-code discount to the queue.

Promotions and manual discounts (from Phase 03) stack as follows: manual line discounts are applied before promotions. If a promotion conflicts with a manually applied discount on a line, the promotion is skipped for that line with a UI note.

### Commission Tracking Design

Each Sale has a `salespersonId` nullable FK (already in the Sale model). When a sale is completed, a `CommissionRecord` is created: `{ saleId, userId: salespersonId, baseAmount: sale.totalAmount, rate: user.commissionRate, earnedAmount: baseAmount × rate }`. Returns that reference the original sale create a negative CommissionRecord to offset the earning. Payouts are tracked via `CommissionPayout` records that sum up all unpaid CommissionRecords for a staff member for a period.

### Hardware Integration Design

ESC/POS printing uses the `escpos` npm library (`pnpm add escpos escpos-network escpos-usb`). A `printer.ts` service wraps the library and exposes `printSaleReceipt(saleId)` and `printZReport(shiftId)`. These functions fetch the data server-side and generate the ESC/POS command sequence. The hardware settings page stores printer configuration in `Tenant.settings.hardware` (a sub-object within the existing JSON settings field).

The Customer Facing Display runs at `/dashboard/[tenantSlug]/cfd` and subscribes to cart updates via a Server-Sent Events (SSE) endpoint at `/api/cfd/stream`. The POS terminal pushes cart state updates to this stream whenever the cart changes.

---

## Data Models Introduced in Phase 04

| Model               | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| Customer            | Full CRM profile with LTV, credit balance, birthday, tags                     |
| Supplier            | Supplier contact and lead time database                                       |
| PurchaseOrder       | Replenishment order linking tenant, supplier, and ordered lines               |
| PurchaseOrderLine   | Per-variant line in a purchase order with qty and cost price                  |
| CommissionRecord    | Per-sale earned commission for a salesperson                                  |
| CommissionPayout    | Tracks payment of accumulated commissions                                     |
| TimeClock           | Staff clock-in / clock-out records                                            |
| Promotion           | Promotion rule definition (type, value, schedule, conditions)                 |
| Expense             | Business expense entry with category and receipt image                        |
| CashMovement        | Within-shift cash events: opening float, petty cash withdrawals, counted cash |

---

## Phase 04 Constraints

1. PayHere payment gateway integration is Phase 05 only — no online payment collection in Phase 04.
2. Multi-location and multi-register are out of scope for Phase 04.
3. Advanced analytics and cross-period reports are Phase 05 — Phase 04 provides operational tables and export only.
4. Email marketing is out of scope — only WhatsApp messaging is used for customer communication.
5. Supplier invoicing and accounts payable tracking are out of scope (purchase order received cost is tracked, not formal accounts payable).
6. Biometric time clocking is out of scope — time clock is manual (button-based) in Phase 04.

---

## Dependencies

- All Phase 03 models must exist and migrations must be applied: Sale, SaleLine, Payment, Shift, ShiftClosure, Return, ReturnLine, StoreCredit
- The `adjustStock` service must accept a transaction client (verified in Phase 03)
- `Sale.salespersonId` and `Sale.customerId` nullable FKs must exist in the schema (introduced in Phase 03 or as an additive migration in Phase 04)
- `User.commissionRate` Decimal nullable field is added in SubPhase_04_02

---

## Exit Criteria

- [ ] Manager can create a customer record and link them to a sale at checkout
- [ ] Store credit balance from Phase 03 is redeemable at POS against a customer's bill
- [ ] Birthday WhatsApp messages are triggered for customers with a birthday today
- [ ] Manager can create a purchase order and dispatch it via WhatsApp to the supplier
- [ ] Goods receiving workflow updates stock with correct reason code PURCHASE_RECEIVED
- [ ] Staff commission report shows correct earned amounts per salesperson for a period
- [ ] A BOGO promotion auto-applies when eligible items are in the POS cart
- [ ] A promo code entered at POS checkout applies the correct discount
- [ ] Expenses are logged and the cash flow statement shows correct income-vs-expense totals
- [ ] A receipt prints directly to a connected thermal printer without the browser print dialog
- [ ] Cash drawer opens on CASH sale completion
- [ ] Customer Facing Display shows the live cart in real time on a second screen
- [ ] Audit log shows all business-critical mutations with actor, timestamp, and before/after values
- [ ] Demo seed data covers customers, suppliers, POs, commissions, and promotions

---

## What Is NOT In Phase 04

| Feature                               | Planned Phase |
| ------------------------------------- | ------------- |
| PayHere recurring billing             | Phase 05      |
| Full analytics dashboard              | Phase 05      |
| PDF/CSV report export                 | Phase 05      |
| Webhook events (sale.completed etc.)  | Phase 05      |
| Multi-location inventory              | Post-Phase 05 |
| Barcode label printing                | Post-Phase 05 |
| Loyalty points program                | Post-Phase 05 |
