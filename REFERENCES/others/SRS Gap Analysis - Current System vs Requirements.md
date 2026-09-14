# SRS Gap Analysis — Current System vs. Customer Requirements

**Client/Brand:** Ruhunu Wedagedara (Ayurvedic Products)
**Date:** 2026-08-07 (revised after deep system audit)
**System:** AyurPOS (ERP + Customer-Facing Website)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | **Fully Implemented** — Feature exists and meets SRS requirements |
| ⚠️ | **Partially Implemented** — Feature exists but has gaps or deviations from SRS |
| ❌ | **Not Implemented** — Feature is completely missing from the system |

---

## Module 1: Customer-Facing Front-End (Web & Mobile)

### 1.1 Product Catalog & Categorization

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Categorized Display | ✅ | Full hierarchical category tree (`Category.parentId`) with Ayurveda seed data. Storefront category section + category pages. | — |
| Detailed Product Pages — Active Ingredients listing | ❌ | `Product` model has `name`, `description`, `tags`, `mainImageUrl` only. No `activeIngredients` field. | Add field + display on detail page. |
| Detailed Product Pages — Usage instructions & dosage | ❌ | No `usageInstructions` / `dosageGuidelines` fields. | Add fields + display. |
| Detailed Product Pages — Health benefits | ❌ | No `healthBenefits` field. | Add field + display. |
| Detailed Product Pages — Safety precautions/warnings | ❌ | No `safetyPrecautions` field. | Add field + display. |
| Search & Filtering — Price range | ⚠️ | Website shop has category pills + sort only. No price range slider. | Add price filter to shop. |
| Search & Filtering — Health concern/need | ❌ | No `HealthConcern` taxonomy. Tags are freeform. | Create taxonomy + filter. |
| Search & Filtering — Product type/form | ⚠️ | ERP inventory has `form` filter. Website shop only category + sort. Variant `form` exists but unused for filtering. | Add form filter to shop. |
| Search & Filtering — Category | ✅ | Website shop category pills + category route. ERP category filter. | — |
| Sitewide keyword search | ❌ | No search box on the storefront (header or shop). | Add product search. |

### 1.2 Localization & User Experience

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Multilingual — Sinhala and English | ❌ | No i18n system. All UI strings hardcoded English. | Implement `next-intl` + Sinhala translations. |
| Multilingual — Structural support for Tamil | ❌ | No Tamil support. | Include Tamil as future locale in i18n architecture. |
| Mobile-Responsive Design | ✅ | Tailwind responsive throughout; mobile Sheet navigation. | — |
| WhatsApp Chat Button (floating) | ⚠️ | Floating WhatsApp button in website header links to a number; WhatsApp Business API used for receipts/broadcasts. Not a dedicated inquiry chat pre-fill. | Verify chat pre-fill for inquiries. |

---

## Module 2: Order Management & Checkout

### 2.1 Checkout Process

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Streamlined Cart & Checkout | ✅ | Full website cart (`cartStore`) + checkout page (`/[tenantSlug]/checkout`) with `CheckoutForm` (guest address form). Places COD order via public orders API (`createWebsiteOrder`). | — |
| Online Payment Gateway — Credit/Debit Card | ❌ | PayHere exists only for subscription billing. Website checkout is COD-only (posts only `codAmount`). No payment SDK in website/erp. | Integrate gateway for customer orders. |
| Cash on Delivery (COD) | ✅ | Checkout button "Place order (COD)"; order created with `DeliverySource.WEBSITE_CHECKOUT`, status `PLACED`. | — |

### 2.2 Live Order Tracking

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Self-Service Order Status (Order ID / Phone) | ❌ | No public tracking portal. `DeliveryStatus` pipeline + tracking exist internally for ERP staff only. Public orders API is POST-only. | Build public track page. |
| Real-time delivery status display | ⚠️ | Delivery status pipeline (PLACED→PENDING_DISPATCH→…→DELIVERED) + `sync-shipments` cron feed exists internally. No customer-facing status view. | Expose status to customers via portal. |

---

## Module 3: Logistics & Third-Party Courier Integration

### 3.1 Courier API Integration

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Automated Dispatch Integration | ⚠️ | Trans Express integration implemented (`lib/courier/trans-express/*`, adapter). `dispatchDelivery` authenticates + uploads + creates `CourierShipment`. **Trans Express only**; `CarrierProvider` enum has one value. | Add provider abstraction + more couriers (Domex/PromptX/Koombiyo). |
| Automated Data Sync — auto-push on dispatch | ✅ | `dispatchDelivery` pushes payload via `transExpressAdapter.uploadSingle` on dispatch approval, writes shipment + events in a transaction. | — |
| Dynamic Delivery Fee Calculation | ⚠️ | Rate engine (`rate-engine.service.ts`) computes fees from `RateCard`/`RateCardEntry` (base + extraKg + zone overrides). Wired into ERP manual delivery. **Not wired into website checkout** (`createWebsiteOrder` leaves `shippingFee` null). | Wire fee calc into website order creation. |

---

## Module 4: Financial Reconciliation & Courier Payout Engine

### 4.1 Remittance & Statement Upload

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| CSV/Excel Remittance Import | ⚠️ | `importRemittanceStatement` + `parseRemittanceCsv` (papaparse). UI `RemittanceUpload` (accept `.csv` only). | Add `.xlsx`/`.xls` parsing. |
| Automated Reconciliation Engine | ⚠️ | Auto-matches statement rows to `ReconciliationLedgerEntry` by **waybillId only**. Idempotent on re-upload. | Add orderRef fallback matching. |
| Status Matching (Delivered + funds match) | ⚠️ | Ledger entry auto-created on `DELIVERED` (PENDING_SETTLEMENT, expectedCod = codAmount). Matches settled≈expected → CLEARED, else PARTIAL_MATCH. | — (works at entry level) |
| Discrepancy Identification | ⚠️ | Produces PARTIAL_MATCH / DISCREPANCY with generic note + counts. Does not sub-categorize unpaid vs underpaid vs unauthorized deductions. | Add deduction categories. |

### 4.2 Fee & Commission Deductions Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Courier Fee Configuration | ✅ | `RateCard` (baseRate, extraKgRate, freeBaseWeightKg, `coddCommissionPct`, `vatRatePct`) + `RateCardEntry` zone overrides. Full UI (`rate-card/`) + validators. | — |
| Net Profit Calculation per order | ⚠️ | Formula `computeNetPayout()` exists in `rate-engine.service.ts` but **is never called** (dead code). | Wire into order/ledger/dashboard. |
| Financial Accuracy Audit | ⚠️ | Discrepancy flagging exists; full contract-term deduction verification not implemented. | Add audit of deductions vs contract. |

### 4.3 Pending COD & Dispute Dashboard

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Aging & Pending COD Tracker | ✅ | `getPendingCodAging` buckets (under7/under14/overdue) + total. UI `ReconciliationClient` flags overdue (>14d) in red. | — |
| Dispute Flagging Engine | ⚠️ | `DISPUTED` status exists in enum + UI styling, but **no code ever sets DISPUTED**; no dispute action or workflow. | Build dispute ticket flow. |

---

## Module 5: Customer Contact Export Engine

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Contact Auto-Sync & Sheet Export | ❌ | Customer data exists. No automated daily contact export or Google Sheet integration. No `xlsx`/exceljs. No export cron. | Build scheduled export to Excel/Google Sheets. |

---

## Module 6: CRM & Repeat Customer Tracking

### 6.1 Visual Identification System

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Loyalty Badges — Gold Star / Repeat (≥2 orders) | ❌ | `Customer` has `totalSpend` but no order-count badge system. No star/repeat indicators in lists/search. | Compute order count; add badges. |
| Repeat Badge (🔁) | ❌ | No repeat badge. | Add visual indicator for ≥2 orders. |

### 6.2 Filter & Analytics

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Dedicated "Repeat Buyers" Tab | ❌ | Customer list filters: search, tag, spendBand only. No repeat-buyer filter. | Add tab/filter. |
| Order frequency count | ⚠️ | Detail page shows "Visits" (`visitCount` from `_count.sales`) + "Avg Order Value". Not in list. | Surface in list too. |
| Total lifetime spend | ✅ | `Customer.totalSpend` shown prominently in list column + detail stat card. | — |
| Preferred product categories | ❌ | No per-customer category aggregation. | Add analytics. |
| Last purchase date | ❌ | No `lastPurchaseAt` field or derived last-sale display. | Add field/metric. |

---

## Module 7: Office Packaging Inventory Module

### 7.1 Dedicated Office Inventory

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Packaging Items — Polymailers (S, M, L) | ⚠️ | `PackagingItem` + `PackagingCategory` (POLYMAILER/TAPE/LABEL/BUBBLE_WRAP/OTHER). Full UI (`delivery/packaging/`). **No structured S/M/L size dimension** (size via free-text `name`). | Add size/variant attribute. |
| Tapes (Clear, Printed, Fragile) | ✅ | TAPE category tracked. | — |
| Shipping Labels & Thermal Stickers | ✅ | LABEL category tracked. | — |
| Bubble Wrap Rolls | ✅ | BUBBLE_WRAP category tracked. | — |

### 7.2 Access Control & Auto-Deduction

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Office-Only View (hidden from factory) | ⚠️ | RBAC gate on packaging page (`managePackaging`; OWNER/MANAGER/DISPATCH_STAFF). No location/warehouse concept — role-only, and no factory role exists to distinguish. | Add location/factory dimension when factory module lands. |
| Auto-Deduction on Dispatch | ✅ | `autoDeductPackaging` decrements + writes `PackagingConsumption` for auto-deduct items inside `dispatchDelivery`. | — |
| Low Stock Alerts for Packaging | ⚠️ | `notifyLowStock` creates `PACKAGING_LOW_STOCK` notifications, but **only on dispatch** and only for auto-deduct items. No scheduled scan. | Add periodic low-stock scan cron. |

---

## Module 8: Factory Store & Raw Materials Module

### 8.1 Raw Material Inventory Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Bulk Oils / Liquid Drums (Liters) | ❌ | No `RawMaterial` model. `ProductVariant.stockQuantity` is Int with string `form`/`packSize`. No numeric unit handling. | Create RawMaterial + L/Kg units. |
| Raw Powders & Dry Herbs (Kilograms) | ❌ | Not modeled. | Add. |
| Preservatives & Chemicals | ❌ | Not modeled. | Add. |

### 8.2 Production Integration (BOM Auto-Deduction)

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Factory-Only Dashboard | ❌ | No factory route, role, or dashboard. `UserRole` has no `FACTORY_MANAGER`. | Add role + dashboard. |
| Bill of Materials (BOM) Auto-Deduction | ❌ | No `BillOfMaterials` model; no production logging; `StockMovementReason` lacks a MANUFACTURED reason. | Add BOM + production flow. |
| Critical Stock Threshold Alerts (raw) | ❌ | No raw-material alert mechanism. | Add low-raw alerts. |

---

## Module 9: Traded & Resale Goods Module

### 9.1 Wholesale & Finished Goods Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Direct Stock-In (GRN / PO) | ⚠️ | Full PO workflow (DRAFT→SENT→PARTIALLY_RECEIVED→RECEIVED) + `GoodsReceivingForm`/`GoodsReceivingModal` + `receivePOLines` + `PURCHASE_RECEIVED` stock movement. **No `productSource` (MANUFACTURED/TRADED)** field. | Add `productSource` distinction. |
| Direct Inventory Entry without factory cycle | ✅ | Products created directly via product wizard (`inventory/new`) with `INITIAL_STOCK`; variants edited directly. | — |

### 9.2 Expiry & Batch Control

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Batch Numbering & Expiry Dates (mandatory) | ❌ | No `batchNumber`/`expiryDate` anywhere. No `BatchTracking` model. | Add batch/expiry tracking. |
| Unified Sales Visibility (batch/expiry) | ❌ | Nothing surfaces batch/expiry in POS, inventory, or reports. | Display batch/expiry + expiry alerts. |

---

## Module 10: Point of Sale (POS) / Counter Sale Module

### 10.1 Quick Billing Interface

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Barcodes & Fast Search | ✅ | `useBarcodeScanner` + debounced product search (SKU/barcode). | — |
| Receipt Printing (thermal) | ✅ | `ReceiptPreviewDialog` → `/api/store/sales/{id}/receipt`; WhatsApp receipt. ESC/POS thermal. | — |

### 10.2 Walk-in CRM Data Capture

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Mandatory Customer Contact (Name + Mobile) | ❌ | Customer linking optional (`Sale.customerId` nullable; Charge/Pay not gated on customer). | Enforce mandatory customer before sale. |

### 10.3 Real-Time Stock & Cash Settlement

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Cash | ✅ | Cash with change calc. | — |
| Credit/Debit Card | ✅ | Card with reference entry. | — |
| LankaQR | ❌ | `PaymentMethod` enum = CASH/CARD/SPLIT. No LankaQR. | Add LankaQR method. |
| Instant Stock Deduction | ✅ | `adjustStockInTx(… SALE)` in sale transaction. | — |
| Daily Sales & Cash Reconciliation | ✅ | Shift open/close, Z-report, cash reconciliation, opening float, cash difference. | — |

---

## Module 11: Zero-Value Order (Rs. 0) Verification & Audit

### 11.1 Reason Selection Mandate

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Required reason for Rs. 0 orders | ❌ | Zero-value sales are **blocked entirely** (Charge/Pay disabled when `amountDue ≤ 0`). No reason flow. | Enable Rs.0 with mandatory reason. |
| Mandatory dropdown (3 reasons) | ❌ | Not implemented. | Add Bank Payment / Replacement / Gift options. |

### 11.2 Mandatory Linkage for Replacements

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Previous Order Validation | ❌ | `Sale.linkedReturnId` exists but no zero-value replacement linkage or historical-order validation. | Add validation on Replacement. |

### 11.3 Fraud Audit Dashboard

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Owner's Daily Rs. 0 Audit Tab | ❌ | No zero-value report. | Build audit dashboard. |

---

## Module 12: Petty Cash Management Module

### 12.1 Fund Allocation & Log

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Petty Cash Balance (configurable opening balance) | ⚠️ | `CashMovement` types include `PETTY_CASH_OUT`/`MANUAL_IN`/`MANUAL_OUT` + `PettyCashSection`. **Shift-bound only** (`CashMovement.shiftId` required); no standalone fund or opening balance. | Add standalone fund. |
| Manager Expense Entry (date, category, amount, receipt) | ✅ | `Expense` model has category, amount, description, `receiptImageUrl`, `expenseDate`, `recordedById`; form covers category/amount/description/date. | — |
| Petty-cash Expense Categories | ⚠️ | `ExpenseCategory` enum is fixed (RENT/SALARIES/UTILITIES/ADVERTISING/MAINTENANCE/MISCELLANEOUS/OTHER). No Staff Meals/Tea-Sugar/Stationery. | Make categories configurable / add petty-cash ones. |
| Receipt photo/scan upload | ⚠️ | `receiptImageUrl` is a **manual text URL field**; no file upload component. | Add upload. |

### 12.2 Owner Supervision & Balance Calculation

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Real-time Balance Equation | ⚠️ | `PettyCashSection` computes shift net petty cash but filters out `OPENING_FLOAT` and ignores `Expense`. Formula not displayed. | Implement Initial Allocation − Expenses. |
| Low Cash Alerts (< Rs. 5,000) | ❌ | No petty-cash low-balance alert or threshold. | Add threshold + owner alert. |
| Exportable Audit Trail (PDF/Excel) | ❌ | Expenses/cash-flow pages are view-only; no export. | Add PDF/Excel export. |

---

## Module 13: Invoice & Custom Label Printing Engine

### 13.1 Layout & Branding

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Prominent Brand Header (logo on labels/invoices) | ⚠️ | `ShippingLabel.tsx` has brand header (logo + brandName + origin) + custom label designer (`label/`). **No printable order/shipping invoice template** exists. | Add invoice template with branding. |

### 13.2 Delivery Accuracy Layout

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Enlarged Customer Info | ✅ | `ShippingLabel.tsx` renders bold/enlarged customer block (name, phone, phone2, full address). | — |
| Dual Barcode — Top-Right (internal) | ✅ | Small white `orderRef` barcode top-right (react-barcode). | — |
| Dual Barcode — Center (courier) | ✅ | Large center `waybillId` barcode. | — |

---

## Module 14: Failed Order & Return Recovery Management

### 14.1 Daily Failed Orders Queue

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Automated Failure Feed from courier | ✅ | `sync-shipments` cron → `processDueTrackingChecks` polls courier; failed statuses set `Delivery.status` + `failureReason` + `CARRIER` events. | — |
| Courier Failure Reason Display | ⚠️ | `Delivery.failureReason` captured but **not rendered** in delivery UI (`DeliveryDetailPanel`/`DeliveryTable`). | Show failure reason in UI. |

### 14.2 Re-Engagement & Redelivery Workflow

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Follow-up Call Log | ❌ | `DeliveryRecovery` model + `RecoveryAction` enum + `manageRecovery` permission exist but are **completely unused** (dead scaffold). | Build recovery workflow. |
| Redelivery Button (re-push to courier) | ❌ | No redeliver action; detail page only offers Dispatch/Print. | Add redeliver + re-push. |
| Permanent Cancel (return to stock) | ⚠️ | `cancelDelivery` sets CANCELED + event but **does not restock** inventory or reverse packaging. | Restock on permanent cancel. |

### 14.3 Lifetime Tracking & Staff Audit

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Lifetime History Trail | ❌ | No `DeliveryRecovery` rows created → no attempt history. | Persist recovery attempts. |
| Staff Performance Metrics | ❌ | No per-staff recovery metrics. | Add dashboard. |

---

## Module 15: Security, RBAC & Audit Trails

### 15.1 Role-Based Access Control (RBAC)

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| **Admin / Owner** — Full Access | ✅ | `ROLE_PERMISSIONS.OWNER = ALL_PERMISSIONS`. ~70 granular keys in `permissions.ts`. | — |
| **Office / Dispatch Staff** — Orders, Courier, Packaging, POS, Customers | ⚠️ | `DISPATCH_STAFF` role exists with delivery (view/create/dispatch/edit/cancel/track) + packaging perms. **No `sale:create` (POS denied) and no `customer:view`.** | Grant POS + customer access per SRS (business decision). |
| **Office / Dispatch Staff** — Restricted: Financials, Reconciliation, Factory | ⚠️ | Recon restricted. **Reports API endpoints are NOT permission-gated** (nav hidden but `/api/reports/*` callable). Factory N/A. | Gate reports API. |
| **Factory Manager** — Factory Store, Production, BOM | ❌ | No `FACTORY_MANAGER` role. | Add role + perms. |
| **Factory Manager** — Restricted: Financials, CRM, Sales, POS | ❌ | No factory role. | Implement restrictions. |

### 15.2 System Activity & Audit Trail

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Silent System Logging (non-editable) | ✅ | `AuditLog` (actorId, actorRole, action, entityType/Id, before/after JSON, ip, userAgent). `audit.service.ts` `createAuditLog` swallows errors; read-only API; no update/delete. | — |
| Audit Inspection (Who/What/When/Prior Value) | ✅ | `/settings/audit-log` page with filters + `AuditLogDetailModal` before/after diff + CSV export. | — |

---

## Summary — Gap Count by Module (revised 2026-08-07)

| Module | Requirements | ✅ Implemented | ⚠️ Partial | ❌ Missing |
|--------|--------------|----------------|------------|------------|
| **M1:** Customer-Facing Front-End | 10 | 2 | 3 | 5 |
| **M2:** Order Management & Checkout | 4 | 2 | 1 | 1 |
| **M3:** Logistics & Courier Integration | 3 | 1 | 2 | 0 |
| **M4:** Financial Reconciliation & Courier Payout | 9 | 2 | 6 | 1 |
| **M5:** Customer Contact Export | 1 | 0 | 0 | 1 |
| **M6:** CRM & Repeat Customer Tracking | 5 | 1 | 1 | 3 |
| **M7:** Office Packaging Inventory | 6 | 3 | 3 | 0 |
| **M8:** Factory Store & Raw Materials | 6 | 0 | 0 | 6 |
| **M9:** Traded & Resale Goods | 4 | 1 | 1 | 2 |
| **M10:** POS / Counter Sale | 6 | 5 | 0 | 1 |
| **M11:** Zero-Value Order Verification | 4 | 0 | 0 | 4 |
| **M12:** Petty Cash Management | 7 | 1 | 4 | 2 |
| **M13:** Invoice & Label Printing | 4 | 3 | 1 | 0 |
| **M14:** Failed Order & Return Recovery | 7 | 1 | 1 | 5 |
| **M15:** Security, RBAC & Audit | 6 | 3 | 2 | 1 |
| **TOTAL** | **82** | **25** | **25** | **32** |

---

## Priority Classification

### 🔴 Critical (Core Business Operations — Missing or Blocking)

1. **Online payment gateway for customer orders** — website is COD-only.
2. **Module 8 — Factory Store, Raw Materials & BOM** — entirely unmodeled.
3. **Module 11 — Zero-Value Order Verification** — Rs. 0 sales currently blocked; no fraud audit.
4. **Module 14.2 — Failed-Order Recovery Workflow** — `DeliveryRecovery` is dead scaffold; no redeliver or restock-on-cancel.
5. **M4.2 Net Profit + M4.3 Dispute Engine** — `computeNetPayout()` and `DISPUTED` defined but unused.

### 🟠 High (Important Business Features — Missing)

6. **M1.1 — Detailed product health-content fields** (ingredients, usage, benefits, safety).
7. **M1.2 — Multilingual (Sinhala/English/Tamil)** — no i18n.
8. **Module 5 — Customer contact export** (Excel/Google Sheets automation).
9. **Module 6 — Loyalty badges + repeat-buyer analytics**.
10. **M9.2 — Batch & expiry tracking** (mandatory for traded goods).
11. **Module 10 — LankaQR + mandatory customer contact in POS**.

### 🟡 Medium (Enhancing / Partial)

12. **M3.3 — Delivery fee calc not wired into website checkout.**
13. **M3.1 / M4.1 — Single courier provider; Excel import; orderRef match fallback.**
14. **M7.1 — Packaging size (S/M/L) dimension + scheduled low-stock scan.**
15. **M12 — Standalone petty-cash fund, categories, low-cash alerts, export.**
16. **M15 — Reports API permission gating + FACTORY_MANAGER role.**
17. **M14.1 — Failure reason not shown in delivery UI.**

### 🟢 Low (Already Well-Implemented)

18. **Module 15 — RBAC & audit trails** (mostly complete).
19. **Module 10 — POS core** (barcode, receipt, stock deduction, reconciliation).
20. **Module 13 — Shipping label with dual barcodes** (fully done).
21. **Module 7 — Packaging module + auto-deduction** (exists).
22. **Module 2.1 — Website checkout (COD)** + **Module 3.2 — auto dispatch**.

---

## Recommended Implementation Phases (next)

### Phase 1 — E-Commerce & Checkout Completeness (M1, M2, M13)
- Online payment gateway for customer orders (PayHere card), alongside existing COD.
- Product detail health-content fields (ingredients, usage, benefits, safety).
- Price / form / health-concern filters + sitewide search.
- Public order tracking portal.
- Printable order/shipping invoice template with branding.

### Phase 2 — Reconciliation & Recovery Completion (M3, M4, M14)
- Wire delivery fee calculation into website checkout.
- Excel remittance import; orderRef matching fallback.
- Net-profit calculation wiring + dispute flagging engine.
- Failed-order recovery workflow (follow-up, redeliver, permanent-cancel restock) + staff audit.

### Phase 3 — CRM, POS & Cash (M6, M10, M11, M12)
- Loyalty badges, repeat-buyer tab, last-purchase & category metrics.
- LankaQR payment + mandatory customer in POS.
- Zero-value order reason flow + owner audit dashboard.
- Standalone petty-cash fund with categories, low-cash alerts, and export.

### Phase 4 — Inventory Expansion (M7, M8, M9)
- Factory manager role + raw materials (L/Kg) + BOM auto-deduction + raw alerts.
- Packaging size dimension + scheduled low-stock scan.
- Batch/expiry tracking + productSource (manufactured/traded) distinction.

### Phase 5 — Refinements (M1.2, M15)
- i18n (Sinhala, English, Tamil structural support).
- Reports API permission gating; FACTORY_MANAGER restrictions; SUPER_ADMIN store-permission nuance.
