# SRS Gap Analysis — Current System vs. Customer Requirements

**Client/Brand:** Ruhunu Wedagedara (Ayurvedic Products)  
**Date:** 2026-07-26  
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
| Categorized Display (e.g., Medicinal Oils, Herbal Ointments, Traditional Decoctions, Wellness Products) | ✅ | Categories are fully implemented with hierarchical tree structure (`Category.parentId`). Seed data includes Ayurveda-specific categories (Herbal Powders, Capsules, Oils, etc.). | — |
| Detailed Product Pages — Active Ingredients listing | ❌ | `Product` model has `name`, `description`, `tags` but **no dedicated `activeIngredients` field**. | Add `activeIngredients String?` field to `Product` model. Display on product detail page. |
| Detailed Product Pages — Usage instructions & dosage guidelines | ❌ | No `usageInstructions` or `dosageGuidelines` fields exist in the schema. | Add `usageInstructions String?` and `dosageGuidelines String?` fields to `Product` model. Display on product detail page. |
| Detailed Product Pages — Health benefits | ❌ | No `healthBenefits` field exists in the schema. | Add `healthBenefits String?` field to `Product` model. Display on product detail page. |
| Detailed Product Pages — Safety precautions/warnings | ❌ | No `safetyPrecautions` or `warnings` field exists in the schema. | Add `safetyPrecautions String?` field to `Product` model. Display on product detail page. |
| Search & Dynamic Filtering — Filter by price range | ⚠️ | Website shop has category + sort filters. ERP inventory has search + category/brand/form/status filters. **No price range filter on customer-facing website.** | Add price range slider/filter to website shop page. |
| Search & Dynamic Filtering — Filter by health concern/need | ❌ | No "health concern" or "need" taxonomy exists. Tags exist but are freeform, not structured by concern. | Create a `HealthConcern` taxonomy (e.g., Joint Pain, Skin Care, Digestive Health, Stress Relief). Link products to concerns. Add filter to website. |
| Search & Dynamic Filtering — Filter by product type | ⚠️ | ERP has `form` filter (Powder, Capsule, Tablet, Oil, etc.). Website shop only has category + sort. | Add product type/form filter to website shop page. |
| Search & Dynamic Filtering — Filter by category | ✅ | Website shop has category filter. ERP has category filter. | — |

### 1.2 Localization & User Experience

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Multilingual Support — Sinhala and English | ❌ | **No internationalization (i18n) system exists.** All content is in English only. No Sinhala or Tamil language support. | Implement full i18n framework (e.g., `next-intl`). Add Sinhala translations for all UI strings. Add bilingual content fields to product descriptions. Structural support for Tamil. |
| Multilingual Support — Structural support for Tamil | ❌ | No Tamil support. | Include Tamil as a future language option in i18n architecture. |
| Mobile-Responsive Design | ✅ | Tailwind CSS responsive design throughout. Mobile sidebar uses Sheet navigation. | — |
| WhatsApp Chat Button (floating) | ⚠️ | WhatsApp integration exists for **sending receipts and broadcasts** (Business API). Website has a **floating WhatsApp button** in the header. However, it's not explicitly a "chat" button for instant customer inquiry — it links to a phone number. | Verify the floating button opens WhatsApp chat with pre-filled message for customer inquiries. |

---

## Module 2: Order Management & Checkout

### 2.1 Checkout Process

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Streamlined Cart & Checkout (one-page or multi-step) | ⚠️ | POS has a full cart + checkout flow. **Customer-facing website has a cart but NO checkout process** — the cart page exists but there's no order placement, address entry, or payment flow for online customers. | Implement full e-commerce checkout on the website: shipping address form, order review, payment integration. |
| Online Payment Gateway — Credit/Debit Card | ❌ | PayHere integration exists **only for subscription billing** (SaaS plans). **No payment gateway for customer orders** on the website. | Integrate PayHere (or alternative) for customer order payments on the website checkout. |
| Cash on Delivery (COD) | ❌ | **No COD option exists.** No delivery/pickup options at all for online orders. | Add COD as a payment method during website checkout. Include COD fee calculation if needed. |

### 2.2 Live Order Tracking

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Self-Service Order Status — Customer inputs Order ID or Phone Number | ❌ | **No customer-facing order tracking portal exists.** Sales are internal POS transactions, not online orders with tracking. | Build a public order tracking page where customers can enter Order ID or phone number to view delivery status. |
| Real-time delivery status display | ❌ | No delivery status tracking system. | Implement order status pipeline (Placed → Confirmed → Dispatched → In Transit → Delivered) with real-time updates. |

---

## Module 3: Logistics & Third-Party Courier Integration

### 3.1 Courier API Integration

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Automated Dispatch Integration (Domex, PromptX, Koombiyo) | ❌ | **No courier API integration exists.** No connection to any Sri Lankan courier services. | Integrate APIs for Domex, PromptX, Koombiyo (or at least one primary courier). Create courier service configuration module. |
| Automated Data Sync — Auto-push order details to courier | ❌ | No auto-push to courier systems. | On dispatch approval, auto-push customer address, contact, COD value to selected courier API. |
| Dynamic Delivery Fee Calculation | ❌ | No delivery fee calculation. Shipping fees are not part of the system. | Implement delivery fee calculator based on destination area + parcel weight/dimensions. Integrate with courier rate APIs. |

---

## Module 4: Financial Reconciliation & Courier Payout Engine

### 4.1 Remittance & Statement Upload

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| CSV/Excel Remittance Import | ❌ | **No remittance upload interface.** CSV import exists only for products and customers. | Build interface to upload courier payout statements (CSV/Excel). |
| Automated Reconciliation Engine | ❌ | No reconciliation system. | Auto-match uploaded statement rows against internal orders using Order ID / Tracking Barcode. |
| Status Matching (Delivered + funds match) | ❌ | Not implemented. | Validate order status and funds received against expected amounts. |
| Discrepancy Identification | ❌ | Not implemented. | Auto-flag unpaid orders, underpaid amounts, unauthorized deductions. |

### 4.2 Fee & Commission Deductions Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Courier Fee Configuration (rate cards per courier) | ❌ | No courier rate card system. | Create rate card configuration per courier: Delivery Fee, COD Commission %, VAT Rate. |
| Net Profit Calculation per order | ❌ | No courier deduction calculation. | Implement formula: `Net Payout = Gross - (Delivery Fee + COD Commission + VAT)`. |
| Financial Accuracy Audit | ❌ | No courier deduction verification. | System verifies courier deductions match pre-configured contract terms. |

### 4.3 Pending COD & Dispute Dashboard

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Aging & Pending COD Tracker | ❌ | No COD tracking. | Build visual dashboard for delivered orders where funds not remitted beyond credit period (flag RED). |
| Dispute Flagging Engine | ❌ | No dispute system. | Create dispute ticket system for missing COD payments or calculation errors. |

---

## Module 5: Customer Contact Export Engine

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Contact Auto-Sync & Sheet Export | ❌ | Customer data exists (`Customer` model with phone, email, etc.). CSV export exists for products. **No automated daily contact list export or Google Sheet integration.** | Build automated daily/weekly customer contact export (phone numbers) to Excel/Google Sheet format. Schedule via cron job. |

---

## Module 6: CRM & Repeat Customer Tracking

### 6.1 Visual Identification System

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Loyalty Badges — Gold Star (⭐️) for customers with ≥2 orders | ❌ | `Customer` model tracks `totalSpend` but **no order count or loyalty badge system**. No visual indicators for repeat customers. | Add `orderCount` field or compute from sales. Display gold star / repeat badge next to customer names in order lists and search results. |
| Repeat Badge (🔁) | ❌ | No repeat badge. | Add repeat badge visual indicator for customers with ≥2 historical orders. |

### 6.2 Filter & Analytics

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Dedicated "Repeat Buyers" Tab | ❌ | Customer list exists but **no repeat buyers filter/tab**. | Add "Repeat Buyers" filter tab in customer management page. |
| Customer Value Metrics — Order frequency count | ❌ | No order frequency displayed. | Show order count per customer in customer list and detail pages. |
| Customer Value Metrics — Total lifetime spend | ⚠️ | `Customer.totalSpend` field exists but **not prominently displayed** in the customer list. | Surface total lifetime spend in customer list columns and detail page. |
| Customer Value Metrics — Preferred product categories | ❌ | No preferred category tracking or display. | Analyze purchase history and display top categories per customer. |
| Customer Value Metrics — Last purchase date | ❌ | No `lastPurchaseAt` field. | Add last purchase date tracking and display. |

---

## Module 7: Office Packaging Inventory Module

### 7.1 Dedicated Office Inventory

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Tracked Packaging Items — Courier Bags / Polymailers (S, M, L) | ❌ | **No packaging inventory tracking.** Current inventory is product-focused only. | Create a separate `PackagingItem` model with categories (Polymailers, Tape, Labels, Bubble Wrap). |
| Tracked Packaging Items — Adhesive Tapes (Clear, Printed, Fragile) | ❌ | Not tracked. | Add tape variants to packaging inventory. |
| Tracked Packaging Items — Shipping Labels & Thermal Barcode Stickers | ❌ | Not tracked. | Add label/sticker tracking to packaging inventory. |
| Tracked Packaging Items — Bubble Wrap Rolls | ❌ | Not tracked. | Add bubble wrap tracking to packaging inventory. |

### 7.2 Access Control & Auto-Deduction

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Office-Only View (hidden from factory) | ❌ | No packaging inventory exists. No role separation between office and factory. | Implement office-only packaging dashboard. Add `DISPATCH_STAFF` or `OFFICE_STAFF` role if needed. |
| Auto-Deduction on Dispatch | ❌ | No auto-deduction. | When an order is dispatched, auto-deduct packaging items (1 Polymailer + 1 Thermal Label per parcel). |
| Low Stock Alerts for Packaging | ❌ | No packaging stock alerts. | Trigger notifications when packaging stock falls below thresholds (e.g., <50 polymailers). |

---

## Module 8: Factory Store & Raw Materials Module

### 8.1 Raw Material Inventory Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Tracked Material Categories — Bulk Herbal Oils & Liquid Drums (Liters) | ❌ | **No raw material tracking.** Inventory only tracks finished goods (ProductVariant). | Create `RawMaterial` model with unit types (Liters, Kilograms, etc.). |
| Tracked Material Categories — Raw Medicinal Powders & Dry Herbs (Kilograms) | ❌ | Not tracked. | Add powder/herb raw material tracking. |
| Tracked Material Categories — Preservatives, Base Ingredients & Processing Chemicals | ❌ | Not tracked. | Add chemical/preservative tracking. |

### 8.2 Production Integration (BOM Auto-Deduction)

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Factory-Only Dashboard | ❌ | No factory dashboard. | Create factory manager dashboard visible only to `FACTORY_MANAGER` role. |
| Bill of Materials (BOM) Auto-Deduction | ❌ | No BOM system exists. | Create `BillOfMaterials` model linking products to raw material requirements. Auto-deduct raw materials when finished goods are logged. |
| Critical Stock Threshold Alerts for Raw Materials | ❌ | No raw material alerts. | Implement low-stock alerts for raw materials sent to factory management and procurement. |

---

## Module 9: Traded & Resale Goods Module

### 9.1 Wholesale & Finished Goods Management

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Direct Stock-In (GRN / PO) | ⚠️ | Purchase Orders exist (`PurchaseOrder` model with status workflow DRAFT→SENT→RECEIVED). Goods receiving form exists. However, **no dedicated "traded goods" concept** separate from manufactured goods. | Add a `productSource` field (MANUFACTURED / TRADED) to distinguish factory-produced vs third-party sourced products. |
| Direct Inventory Entry without BOM/factory cycle | ⚠️ | Stock adjustments and PO receiving exist. Products can be added directly. | Ensure traded goods can bypass BOM/production workflow entirely. |

### 9.2 Expiry & Batch Control

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Batch Numbering & Expiry Dates (mandatory) | ❌ | **No batch tracking or expiry date fields** on `ProductVariant` or any inventory model. | Add `batchNumber String?` and `expiryDate DateTime?` fields to stock movements or a new `BatchTracking` model. Make mandatory for traded goods. |
| Unified Sales Visibility with batch/expiry info | ❌ | No batch/expiry info visible in POS or inventory. | Display batch number and expiry date in POS, inventory lists, and stock reports. Add expiry-based alerts. |

---

## Module 10: Point of Sale (POS) / Counter Sale Module

### 10.1 Quick Billing Interface

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Barcodes & Fast Search | ✅ | Barcode scanner hook (`useBarcodeScanner`) with rapid keyboard input detection. Product search with debounced lookup. | — |
| Receipt Printing (thermal) | ✅ | Thermal receipt rendering (58mm/80mm) via ESC/POS. Network printer support. | — |

### 10.2 Walk-in CRM Data Capture

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Mandatory Customer Contact Fields (Name + Mobile before finalizing) | ⚠️ | Customer linking exists in POS (`CustomerSearchDropdown`). **However, it is NOT mandatory** — sales can be completed without a customer. | Make customer name + mobile number mandatory before completing a POS transaction. Add validation gate in checkout flow. |

### 10.3 Real-Time Stock & Cash Settlement

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Payment Methods — Cash | ✅ | Cash payment with change calculation. | — |
| Payment Methods — Credit/Debit Card | ✅ | Card payment with reference number. | — |
| Payment Methods — LankaQR | ❌ | **No LankaQR payment support.** Payment methods are Cash, Card, and Split only. | Add LankaQR as a payment method option in POS. |
| Instant Stock Deduction | ✅ | Stock deducted immediately on sale completion via `StockMovement` with reason `SALE`. | — |
| Daily Sales & Cash Reconciliation | ✅ | Shift management with opening float, cash movements, Z-report generation. Cash difference calculation. | — |

---

## Module 11: Zero-Value Order (Rs. 0) Verification & Audit

### 11.1 Reason Selection Mandate

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Required reason classification for Rs. 0 orders | ❌ | **No zero-value order handling.** No special validation for zero-total sales. | Add validation: when sale total = Rs. 0, require selecting a reason from dropdown (Bank Payment, Product Replacement, Complimentary Gift). |
| Mandatory drop-down with 3 reason options | ❌ | Not implemented. | Create reason selection dropdown with the 3 specified options. |

### 11.2 Mandatory Linkage for Replacements

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Previous Order Validation for "Product Replacement" | ❌ | Returns system exists (`Return` model linked to `originalSaleId`) but **not integrated with zero-value order flow**. | When "Product Replacement" is selected, require inputting Original Order ID. Validate against historical orders. Block without valid reference. |

### 11.3 Fraud Audit Dashboard

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Owner's Daily Audit Tab for Rs. 0 orders | ❌ | No zero-value audit dashboard. | Build dedicated report showing all Rs. 0 orders in last 24 hours with Issuer Staff, Reason, Linked Order ID, Recipient Details. |

---

## Module 12: Petty Cash Management Module

### 12.1 Fund Allocation & Log

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Petty Cash Balance Tracking (configurable opening balance) | ⚠️ | `CashMovement` model exists with types `OPENING_FLOAT`, `PETTY_CASH_OUT`, `MANUAL_IN`, `MANUAL_OUT`. Shift-based petty cash section exists (`PettyCashSection` component). **However, no configurable initial petty cash allocation outside of shifts.** | Add configurable petty cash fund allocation (e.g., Rs. 30,000) independent of POS shifts. |
| Manager Expense Entry (date, category, amount, receipt) | ⚠️ | `Expense` model exists with category, amount, description, receipt image. **But expenses are not tied to petty cash fund.** | Link expense entries to petty cash fund. Ensure petty cash deductions reflect logged expenses. |
| Expense Categories (Staff meals, tea/sugar, office stationery) | ⚠️ | `ExpenseCategory` enum has: RENT, SALARIES, UTILITIES, ADVERTISING, MAINTENANCE, MISCELLANEOUS, OTHER. **Missing petty-cash-specific categories** like Staff Meals, Tea/Sugar, Office Stationery. | Add petty-cash-specific expense categories or make categories configurable. |
| Receipt photo/scan upload (optional) | ✅ | `Expense.receiptImageUrl` field exists. Media upload component exists. | — |

### 12.2 Owner Supervision & Balance Calculation

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Real-time Balance Equation | ⚠️ | Basic cash flow exists but **not the exact petty cash balance formula**. | Implement: `Current Petty Cash Balance = Initial Allocation - Total Logged Expenses`. Display prominently. |
| Low Cash Alerts (e.g., < Rs. 5,000) | ❌ | **No petty cash low balance alerts.** Low stock alerts exist but not for petty cash. | Add configurable threshold for petty cash low balance. Send alert to business owner when breached. |
| Exportable Audit Trail (PDF/Excel) | ⚠️ | Report export (CSV/Excel) exists for other reports. **No dedicated petty cash expense report.** | Add petty cash expense report exportable in PDF/Excel format for period-end accounting. |

---

## Module 13: Invoice & Custom Label Printing Engine

### 13.1 Layout & Branding

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Prominent Brand Header (Ruhunu Wedagedara logo on labels/invoices) | ❌ | Receipt renderer exists for POS receipts. **No shipping label or invoice template with prominent brand logo.** Barcode label printing exists (`BarcodeLabel` component) but without brand header. | Create shipping label template with centered/top-left brand logo. Update invoice template with prominent branding. |

### 13.2 Delivery Accuracy Layout

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Enlarged Customer Info (Name, Phone, Address in bold/enlarged text) | ❌ | No shipping label with enlarged customer info. | Design shipping label with enlarged, bold customer name, phone, and address for courier dispatch handlers. |
| Dual Barcode Display — Top-Right (internal scanning) | ❌ | Barcode labels exist but **no dual barcode layout**. | Add top-right barcode for internal office scanning and packing verification. |
| Dual Barcode Display — Center Shipping Label (courier scanning) | ❌ | No center barcode on shipping label. | Add large center barcode/QR code for courier scanning on shipping label. |

---

## Module 14: Failed Order & Return Recovery Management

### 14.1 Daily Failed Orders Queue

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Automated Failure Feed from courier API | ❌ | **No courier integration, so no failure feed.** Returns exist but only for POS transactions, not courier failures. | Integrate courier API to auto-populate orders marked "Returned to Branch Failed". |
| Courier Failure Reason Display | ❌ | No failure reason tags. | Display courier-provided failure reasons (Phone Switched Off, Wrong Address, Postponed, Customer Refused). |

### 14.2 Re-Engagement & Redelivery Workflow

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Follow-up Call Log | ❌ | No call-back workflow for failed deliveries. | Build follow-up call log interface for office staff to contact customers and update status. |
| Redelivery Button (reschedule + re-push to courier) | ❌ | No redelivery system. | Add "Redeliver" action that reschedules delivery and re-pushes order payload via courier API. |
| Permanent Cancel (return to stock) | ❌ | No permanent cancel for failed deliveries. | Add "Permanent Cancel" action that marks item as returned to stock, updating inventory. |

### 14.3 Lifetime Tracking & Staff Audit

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Lifetime History Trail for failed→delivered conversions | ❌ | No failed order audit trail. | Preserve permanent audit trail for orders initially marked failed but subsequently converted to "Delivered". |
| Staff Performance Metrics (recovery rates) | ❌ | Staff performance reports exist for sales/returns but **not for failed order recovery**. | Track per-staff: assigned failed orders, successfully recovered, permanently cancelled. |

---

## Module 15: Security, RBAC & Audit Trails

### 15.1 Role-Based Access Control (RBAC)

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| **Admin / Owner** — Full Access | ✅ | `OWNER` role has full access to all modules. ~50 granular permissions. | — |
| **Office / Dispatch Staff** — Order Processing, Courier API, Packaging Stock, POS, Customer Lists | ⚠️ | `MANAGER` and `CASHIER` roles exist. Permissions cover POS, inventory, customers, stock. **But no dedicated "Office/Dispatch Staff" role**, and no Packaging Stock or Courier API access (since those modules don't exist). | Create `DISPATCH_STAFF` role or map to existing roles once courier/packaging modules are built. |
| **Office / Dispatch Staff** — Restricted: Financial Reports, Courier Reconciliation, Factory Raw Materials | ⚠️ | Permission-based restrictions exist. **No courier reconciliation or factory modules to restrict.** | Enforce restrictions when new modules are added. |
| **Factory Manager** — Factory Store, Production Logging, BOM Config | ❌ | **No `FACTORY_MANAGER` role exists.** No factory-specific permissions. | Add `FACTORY_MANAGER` role with factory-only permissions. |
| **Factory Manager** — Restricted: Financials, Customer CRM, Sales Orders, POS | ❌ | No factory role or restrictions. | Implement factory role with appropriate restrictions. |

### 15.2 System Activity & Audit Trail

| Requirement | Status | Current State | Gap / Action Needed |
|-------------|--------|---------------|---------------------|
| Silent System Logging (non-editable) | ✅ | `AuditLog` model with before/after JSON snapshots. Covers order modifications, stock adjustments, etc. | — |
| Audit Inspection — Who, What, When, Prior Value | ✅ | `AuditLog` has `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `before`, `after`, `ipAddress`, `userAgent`, `createdAt`. Full audit trail viewer with filters. | — |

---

## Summary — Gap Count by Module

| Module | SRS Requirements | ✅ Implemented | ⚠️ Partial | ❌ Missing |
|--------|-----------------|----------------|------------|------------|
| **M1:** Customer-Facing Front-End | 7 | 2 | 2 | 3 |
| **M2:** Order Management & Checkout | 4 | 0 | 1 | 3 |
| **M3:** Logistics & Courier Integration | 3 | 0 | 0 | 3 |
| **M4:** Financial Reconciliation & Courier Payout | 7 | 0 | 0 | 7 |
| **M5:** Customer Contact Export | 1 | 0 | 0 | 1 |
| **M6:** CRM & Repeat Customer Tracking | 5 | 0 | 1 | 4 |
| **M7:** Office Packaging Inventory | 5 | 0 | 0 | 5 |
| **M8:** Factory Store & Raw Materials | 5 | 0 | 0 | 5 |
| **M9:** Traded & Resale Goods | 4 | 0 | 2 | 2 |
| **M10:** POS / Counter Sale | 6 | 4 | 1 | 1 |
| **M11:** Zero-Value Order Verification | 4 | 0 | 0 | 4 |
| **M12:** Petty Cash Management | 5 | 1 | 3 | 1 |
| **M13:** Invoice & Label Printing | 4 | 0 | 0 | 4 |
| **M14:** Failed Order & Return Recovery | 5 | 0 | 0 | 5 |
| **M15:** Security, RBAC & Audit | 4 | 2 | 2 | 0 |
| **TOTAL** | **69** | **9** | **12** | **48** |

---

## Priority Classification

### 🔴 Critical (Core Business Operations — Missing Entirely)

1. **Module 2: Order Management & Checkout** — No online checkout, no payment gateway for orders, no COD
2. **Module 3: Logistics & Courier Integration** — No courier API integration at all
3. **Module 4: Financial Reconciliation** — No courier payout reconciliation engine
4. **Module 14: Failed Order & Return Recovery** — No courier failure handling or recovery workflow

### 🟠 High (Important Business Features — Missing)

5. **Module 1: Multilingual Support** — No Sinhala/Tamil language support
6. **Module 6: CRM & Loyalty** — No repeat customer badges, no customer value metrics
7. **Module 7: Packaging Inventory** — No packaging supply tracking
8. **Module 8: Factory/Raw Materials** — No BOM or raw material management
9. **Module 13: Shipping Labels** — No branded shipping label with dual barcodes

### 🟡 Medium (Enhancing Features — Partially or Not Implemented)

10. **Module 11: Zero-Value Orders** — No fraud prevention for Rs. 0 orders
11. **Module 12: Petty Cash** — Partially exists, needs refinement
12. **Module 9: Batch/Expiry Tracking** — No batch or expiry date tracking
13. **Module 1: Product Detail Fields** — Missing active ingredients, usage, health benefits, safety info
14. **Module 10: LankaQR + Mandatory Customer** — Missing LankaQR, customer not mandatory

### 🟢 Low (Already Well-Implemented)

15. **Module 15: RBAC & Audit** — Mostly complete, needs factory role
16. **Module 10: POS Core** — Barcode scanning, receipt printing, stock deduction, shift management all working
17. **Module 12: Expense Tracking** — Basic expense tracking exists

---

## Recommended Implementation Phases

### Phase 1 — E-Commerce Foundation (Modules 2, 13)
- Website checkout flow (address → payment → confirmation)
- PayHere integration for customer orders
- COD option
- Order tracking portal
- Branded shipping labels with dual barcodes
- **Product schema updates** (active ingredients, usage, health benefits, safety)

### Phase 2 — Logistics & Reconciliation (Modules 3, 4, 14)
- Courier API integration (Domex/PromptX/Koombiyo)
- Automated dispatch and delivery fee calculation
- Remittance upload and reconciliation engine
- COD tracking dashboard
- Failed order queue and recovery workflow
- Dispute management

### Phase 3 — CRM & Operations (Modules 5, 6, 11)
- Customer contact export automation
- Loyalty badges and repeat buyer tracking
- Customer value metrics dashboard
- Zero-value order verification and audit

### Phase 4 — Inventory Expansion (Modules 7, 8, 9)
- Packaging inventory module (office-only)
- Factory raw materials module
- BOM configuration and auto-deduction
- Batch numbering and expiry tracking
- Traded goods differentiation

### Phase 5 — Refinements (Modules 1, 12, 15)
- i18n implementation (Sinhala, English, Tamil structural support)
- Petty cash standalone fund management
- Factory manager role
- LankaQR payment integration
- Health concern taxonomy for product filtering
