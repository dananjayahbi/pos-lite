# Phase 02 — The Catalog

## Metadata

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Phase Number**   | 02                                                                    |
| **Codename**       | The Catalog                                                           |
| **Document Type**  | Layer 1 — Phase Overview                                              |
| **Status**         | Not Started                                                           |
| **Created**        | 2026-03-17                                                            |
| **Last Updated**   | 2026-03-17                                                            |
| **Dependencies**   | Phase 01 — The Foundation (fully complete)                            |
| **Parent Document**| `00_Project_Overview.md`                                              |

---

## Table of Contents

- [Phase 02 — The Catalog](#phase-02--the-catalog)
  - [Metadata](#metadata)
  - [1. Phase Goal](#1-phase-goal)
  - [2. Key Deliverables](#2-key-deliverables)
  - [3. Sub-Phase Breakdown](#3-sub-phase-breakdown)
    - [3.1 SubPhase 02.01 — Product & Variant Data Models](#31-subphase-0201--product--variant-data-models)
    - [3.2 SubPhase 02.02 — Product Management UI](#32-subphase-0202--product-management-ui)
    - [3.3 SubPhase 02.03 — Advanced Stock Control](#33-subphase-0203--advanced-stock-control)
  - [4. Technical Foundations](#4-technical-foundations)
    - [4.1 Data Model Design](#41-data-model-design)
    - [4.2 Clothing-Specific Inventory Logic](#42-clothing-specific-inventory-logic)
    - [4.3 File Storage Integration](#43-file-storage-integration)
    - [4.4 Barcode and SKU System](#44-barcode-and-sku-system)
  - [5. Phase Constraints & Rules](#5-phase-constraints--rules)
  - [6. Dependencies Between Sub-Phases](#6-dependencies-between-sub-phases)
  - [7. Exit Criteria](#7-exit-criteria)
  - [8. What Is NOT in This Phase](#8-what-is-not-in-this-phase)

---

## 1. Phase Goal

Phase 02 — The Catalog — builds the complete clothing-grade product catalog and inventory management system. By the end of this phase, the store owner can define their entire product range, complete with size and colour variants, three-tier pricing, barcode assignment, product photography, and precise stock levels. Stock movements are tracked atomically with full audit trails, low stock alerts fire correctly, and a formal stock take workflow allows periodic physical inventory counts to reconcile with system records.

The goal of this phase is to answer the question: **"Does the system know what the store sells and how much is on the shelf?"** Every subsequent phase depends on Phase 2 producing accurate, query-friendly inventory data. Phase 3 (POS Terminal) requires variants and stock levels to process sales. Phase 4 (Operations) requires the full catalog for purchase orders. Phase 5 (Platform) requires historical stock data for reporting. The correctness and performance of the catalog built in Phase 2 directly determines the quality of the entire application.

Unlike Phase 1 (which was mostly infrastructure with limited visible output), Phase 2 produces tangible, demo-ready features. By the end of this phase, a store owner can open the management portal, navigate to Inventory, and manage their entire product range through a polished, intuitive interface.

---

## 2. Key Deliverables

| Deliverable                              | Description                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Category & Brand Models**              | Prisma models for `Category` and `Brand` with CRUD API routes and management UI.                     |
| **Product Model**                        | Full `Product` Prisma model with clothing-specific fields: gender, tags, taxRule, category, brand. Soft delete. |
| **ProductVariant Model**                 | Full `ProductVariant` model with size, colour, SKU, barcode, three-tier pricing, stock quantity, low stock threshold, and image URLs. |
| **StockMovement Model**                  | Atomic stock movement audit trail capturing every increase or decrease with reason code, actor, and timestamp. |
| **StockTakeSession & Items Models**      | Models supporting the multi-step stock take workflow: session creation, item scanning, discrepancy calculation, and approval. |
| **Product Service Layer**                | Complete `product.service.ts` with type-safe functions for all product and variant operations.        |
| **Inventory Service Layer**              | Complete `inventory.service.ts` with stock adjustment, stock take, low stock queries, and valuation.  |
| **Product API Routes**                   | REST API routes for products, variants, categories, and brands — full CRUD with tenant isolation.     |
| **File Storage Integration**             | Product image upload via Supabase Storage or Cloudinary. Images stored as URL arrays on `ProductVariant`. |
| **Product Creation Wizard**              | Multi-step UI: Step 1 collects base product info; Step 2 defines size and colour axes and auto-generates the variant matrix. |
| **Product List Page**                    | Inventory list with search, category/brand/gender filter, sort, and pagination. Status badges for archived/low stock. |
| **Product Detail Page**                  | Full product profile showing all variants in a matrix table, stock levels per variant, price editor, and image gallery. |
| **Variant Edit Panel**                   | Inline or drawer-based editor for updating an individual variant's price, barcode, threshold, and stock. |
| **Category & Brand Management**          | Management pages (or modals) for creating, editing, and soft-deleting categories and brands.          |
| **Bulk Price Update Tool**               | Select a category or brand, enter a percentage multiplier, preview affected variants, and apply the bulk price change. |
| **Barcode Label Printing**               | Select one or more variants and generate a printable PDF of barcode labels formatted for standard label sheets. |
| **CSV Import**                           | Template-driven CSV import for bulk product creation. Validates rows, reports errors, creates products and variants in batch. |
| **CSV Export**                           | Export the full inventory (all products and variants with pricing and stock levels) to CSV for offline analysis. |
| **Stock Control Page**                   | Dedicated stock management hub showing stock levels, adjustment history, and quick-adjust controls.   |
| **Manual Stock Adjustment**              | Form for adjusting stock of any variant with a required reason code (Found, Damaged, Stolen, Error, Returned to Supplier). |
| **Stock Movement History**               | Paginated, filterable timeline of all stock movements per variant or globally across all products.    |
| **Stock Take Module**                    | Guided counting interface: select category, scan/enter variants, view discrepancies, submit for approval. |
| **Stock Take Approval Workflow**         | Owner/Manager reviews the stock take discrepancy report and approves or rejects the proposed adjustments. |
| **Low Stock Alert Widget**               | Dashboard widget and per-product indicator showing variants at or below their `lowStockThreshold`.   |
| **Product Search Validators**            | Complete Zod schemas for all product and variant request bodies used in forms and API validation.     |
| **Sample Catalog Seed**                  | Seeder script populating the development database with 30+ sample products across multiple categories. |

---

## 3. Sub-Phase Breakdown

### 3.1 SubPhase 02.01 — Product & Variant Data Models

**Folder:** `SubPhase_02_01_Product_Data_Models/`

This sub-phase establishes every Prisma model needed for the catalog and inventory system. No UI is built in this sub-phase — only the data layer, service layer, API routes, and validators. Everything built in Sub-Phase 02.01 forms the foundation that Sub-Phases 02.02 and 02.03 build upon.

**What is built:**
- `Category`, `Brand`, `Product`, `ProductVariant` Prisma models with all fields and relations
- `StockMovement` model capturing all stock quantity changes
- `StockTakeSession` and `StockTakeItem` models for the physical count workflow
- Enums: `GenderType` (MEN, WOMEN, UNISEX, KIDS, TODDLERS), `TaxRule` (STANDARD_VAT, SSCL, EXEMPT), `StockMovementReason` (FOUND, DAMAGED, STOLEN, DATA_ERROR, RETURNED_TO_SUPPLIER, INITIAL_STOCK, SALE_RETURN, PURCHASE_RECEIVED)
- Database migration for all catalog models
- `product.service.ts` with full CRUD service functions for products, variants, categories, and brands
- `inventory.service.ts` with stock adjustment, stock take, valuation, and low stock query functions
- Complete API route handlers for products and variants
- Zod validators for all product and variant request bodies
- File storage integration utility in `src/lib/storage.ts`
- Initial sample catalog seeder script extension

**Task count:** 12 tasks

---

### 3.2 SubPhase 02.02 — Product Management UI

**Folder:** `SubPhase_02_02_Product_Management_UI/`

This sub-phase builds all user-facing product management screens. Every UI component uses the VelvetPOS design system and follows the access control constraints (cost prices hidden from Cashiers, etc.).

**What is built:**
- Inventory list page with search, filters, sort, and pagination
- Product creation wizard with two steps — base info and variant matrix generation
- Product detail page with variant matrix table, pricing editor, and image gallery
- Variant edit panel (drawer-based) for individual variant management
- Category and brand management pages
- Bulk price update tool with preview
- Barcode label printing feature generating PDF output
- CSV import interface with validation feedback
- CSV export feature with configurable column selection
- Product image upload integrated into the product detail page and creation wizard
- Enhanced product search with full-text support and filter chips

**Task count:** 12 tasks

---

### 3.3 SubPhase 02.03 — Advanced Stock Control

**Folder:** `SubPhase_02_03_Stock_Control/`

This sub-phase builds the advanced stock management capabilities — the features that distinguish a professional inventory management system from a basic product list.

**What is built:**
- Stock control hub page (`/stock`) with stock level overview and navigation
- Manual stock adjustment form with reason codes and immediate stock update
- Stock movement history timeline with filtering by product, reason, and date range
- Guided stock take interface — session creation, variant selection, physical count entry
- Discrepancy report view comparing physical counts against system quantities
- Stock take approval workflow for Owner/Manager review and confirmation
- Low stock alert widget on the main store dashboard
- Low stock threshold notification system (in-app only in Phase 2; WhatsApp/email in Phase 5)
- Stock valuation view (total inventory at cost price and retail price)
- Audit logging wired into all stock movement creation

**Task count:** 12 tasks

---

## 4. Technical Foundations

### 4.1 Data Model Design

The two-level product hierarchy (`Product` → `ProductVariant`) is central to everything in Phase 2. The `Product` model represents the base product concept (e.g., "Classic Polo Shirt"), while `ProductVariant` represents each unique, sellable, individual SKU (e.g., "Classic Polo Shirt — Red — Large").

Every `ProductVariant` carries its own stock quantity (`stockQuantity`), its own pricing tiers (`costPrice`, `retailPrice`, `wholesalePrice`), its own barcode, and its own image URLs. This is intentionally denormalised: while sizes and colours could be separate relational models, the complexity of managing a many-to-many variant matrix through pure normalisation creates more friction than value in a clothing retail domain. The flat variant model is both simpler to query and faster for the POS terminal barcode lookup.

The `tenantId` field is present on `Product`, `ProductVariant`, `Category`, `Brand`, `StockMovement`, and `StockTakeSession`. Multi-tenant isolation is enforced at the service layer for every query.

All monetary fields (`costPrice`, `retailPrice`, `wholesalePrice`) are stored as PostgreSQL `NUMERIC(12,2)` via Prisma's `Decimal` type. All calculations involving these fields must use the `Decimal` type from the `decimal.js` library — never JavaScript floating-point arithmetic.

### 4.2 Clothing-Specific Inventory Logic

The size and colour variant matrix is the defining complexity of clothing inventory. VelvetPOS handles this with the following approach during product creation:

The product creation wizard's second step allows the user to define a set of sizes (e.g., S, M, L, XL, XXL) and a set of colours (e.g., Red, Navy Blue, Black). The wizard then auto-generates all combinations as individual `ProductVariant` records. For 4 sizes × 5 colours, this creates 20 variants instantly. SKUs are auto-generated in the format `[PRODUCT-CODE]-[COLOUR-ABBREV]-[SIZE]` (e.g., `POLO-RED-M`) but can be manually overridden per variant.

Not all size × colour combinations are always valid (some colours only come in certain sizes). The wizard allows the user to deselect specific auto-generated combinations before saving. The deselected combinations are simply not created as `ProductVariant` records.

Gender-specific sizing conventions are handled through the `Gender` field on the product and a flexible `size` string field on the variant — there is no enforced size scale. The system accepts any string as a size value, accommodating Men's numeric trouser sizes (30, 32, 34), Women's dress sizes (XS, S, M), children's age-based sizes (2Y, 4Y), and international size formats.

### 4.3 File Storage Integration

Product images are stored in either Supabase Storage or Cloudinary, selectable via the `STORAGE_PROVIDER` environment variable. A unified `src/lib/storage.ts` module provides a storage-agnostic `uploadFile(file, path)` function that routes to the correct provider implementation.

The `ProductVariant.imageUrls` field stores an array of public image URLs. The first URL in the array is treated as the primary display image. Images are uploaded in WebP format at a maximum of 1200×1200 pixels. Client-side image compression is applied before upload to reduce bandwidth.

Since multiple variants of the same product often share images (e.g., a polo shirt photo that applies to all sizes of a given colour), the UI exposes an "Apply to all [colour] variants" option when uploading an image to a specific variant.

### 4.4 Barcode and SKU System

SKUs follow the format `[BRAND-CODE]-[COLOUR-ABBREV]-[SIZE]` where `BRAND-CODE` is derived from the brand name (first 3 characters, uppercased), `COLOUR-ABBREV` is the first 5 characters of the colour name (uppercased, spaces replaced with dashes), and the size as entered. This format is auto-suggested but fully editable.

Barcodes are optional on `ProductVariant`. The system accepts EAN-13, Code-128, and internal barcode formats. Uniqueness of barcodes is enforced at the database level within each tenant (unique index on `tenantId, barcode`).

The barcode label print feature generates a PDF using a server-side rendering approach (server component using a PDF generation library). Labels are formatted for common thermal label sizes (57×32mm and 40×30mm) and for A4 sheet-based labels (24-up and 65-up. configurations).

---

## 5. Phase Constraints & Rules

1. **No POS terminal integration yet.** Products and variants created in Phase 2 will be used by the POS terminal in Phase 3, but no POS-specific logic (cart operations, sale creation, barcode scanning for cart addition) is implemented here.

2. **No purchase order integration yet.** Stock can be manually adjusted but there is no supplier purchase order flow in this phase (that is Phase 4). Initial stock levels are set via the "Initial Stock" reason code in manual adjustments.

3. **Atomic stock operations.** All stock quantity changes must go through `StockMovement` records — the `ProductVariant.stockQuantity` field is never updated directly without creating a corresponding `StockMovement`. The service layer enforces this invariant.

4. **Cost price visibility.** The `costPrice` field is hidden from any user with the `CASHIER` role at both the API and UI levels. The `product:view_cost_price` permission is required to see cost prices. The `ProductVariant` API response omits `costPrice` unless the requesting user has this permission.

5. **No negative stock.** Manual stock adjustments that would push a variant's `stockQuantity` below zero are rejected with a validation error. The only operation that can create negative stock is a sale (Phase 3) where the `allowNegativeStock` setting overrides this — but that setting is deferred to Phase 3.

6. **Soft deletes throughout.** Archiving products uses the `isArchived` boolean (hides from POS without affecting history). Permanent soft-delete uses `deletedAt`. Categories and brands cannot be deleted if they have associated products — the service layer returns a conflict error.

7. **Image upload is optional.** No field requiring an image upload should be mandatory. Products and variants without images display a standard placeholder in the UI.

---

## 6. Dependencies Between Sub-Phases

```
SubPhase 02.01 (Product & Variant Data Models)
        ↓
SubPhase 02.02 (Product Management UI)         ← Requires API routes from 02.01
        ↓
SubPhase 02.03 (Advanced Stock Control)        ← Requires both 02.01 and 02.02 complete
```

- **02.02 depends on 02.01** because the product management UI calls the API routes and service functions from 02.01. The variant matrix generation wizard requires the `product.service.ts` functions. The category and brand dropdowns require the Category and Brand API routes.

- **02.03 depends on both 02.01 and 02.02** because the stock control hub is contextually integrated with the product management pages (stock adjustment can be initiated from the product detail page), and the stock take workflow uses the full product search and filter functionality from 02.02.

---

## 7. Exit Criteria

Phase 2 is considered complete when ALL of the following criteria are satisfied:

- [ ] `pnpm tsc --noEmit` passes with zero errors.
- [ ] `pnpm eslint src/` passes with zero errors and zero warnings.
- [ ] All Prisma migrations for Phase 2 run cleanly on a fresh PostgreSQL database.
- [ ] Store Owner account can log in, navigate to `/inventory`, and see the product list page with search, filter, and pagination working.
- [ ] Product creation wizard successfully generates a 3×4 variant matrix (3 sizes × 4 colours = 12 variants) with auto-generated SKUs.
- [ ] Individual variant prices can be edited and saved — the update is reflected immediately in the list.
- [ ] A manually uploaded product image is stored in the file storage provider and displayed on the product detail page.
- [ ] Barcode assignment: a specific EAN-13 barcode value can be saved to a `ProductVariant` record.
- [ ] Stock adjustment form submits with a reason code, and the `ProductVariant.stockQuantity` updates correctly, with a corresponding `StockMovement` record created.
- [ ] Attempting a stock adjustment that would make quantity negative is rejected with an appropriate error.
- [ ] A stock take session can be created, items scanned and counted, discrepancies viewed, and the session approved — resulting in stock quantities being updated.
- [ ] The low stock alert widget on the dashboard shows variants below their threshold.
- [ ] CSV export produces a valid CSV file with all product and variant data.
- [ ] CSV import with a valid template file creates products and variants correctly.
- [ ] Bulk price update form increases all variant prices in a category by a given percentage and previews the change before confirmation.
- [ ] Barcode label PDF generates correctly for a selection of variants.
- [ ] `CASHIER` role user cannot see `costPrice` values in any UI or API response.
- [ ] The seeder populates 30+ sample products with variants and stock levels that can be browsed in the inventory list.

---

## 8. What Is NOT in This Phase

| Excluded Item                        | Deferred To                |
| ------------------------------------ | -------------------------- |
| POS terminal product grid and barcode scanning | Phase 3 — The Terminal |
| Sale-driven stock deductions          | Phase 3 — The Terminal     |
| Returns and restock from returns     | Phase 3 — The Terminal     |
| Supplier data model and purchase orders | Phase 4 — The Operations |
| Goods receiving workflow (PO-based stock update) | Phase 4 — The Operations |
| WhatsApp low stock notifications     | Phase 5 — The Platform     |
| Email daily stock digest             | Phase 5 — The Platform     |
| Inventory aging and dead stock reports | Phase 5 — The Platform   |
| Stock valuation in P&L statement     | Phase 5 — The Platform     |
