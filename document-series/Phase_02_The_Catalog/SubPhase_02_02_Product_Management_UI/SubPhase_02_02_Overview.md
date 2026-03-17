# SubPhase 02.02 — Product Management UI

## Metadata

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| Phase        | 02 — The Catalog                                    |
| Sub-Phase    | 02.02 — Product Management UI                       |
| Complexity   | High                                                |
| Depends On   | SubPhase 02.01 — Product Data Models (fully complete) |
| Status       | Planned                                             |
| Total Tasks  | 12                                                  |

---

## Objective

Build all user-facing product and inventory management screens within the tenant dashboard. By the end of this sub-phase, a store OWNER or MANAGER can create, edit, and manage the complete clothing catalog through the browser — from adding the first product through the guided wizard to performing bulk price updates across hundreds of variants. CASHIER roles retain read-only access to the inventory list but are blocked from creation, editing, and management tooling by RBAC permission gates enforced at both the API and UI layers.

---

## Scope

### In Scope

- Inventory List page at /dashboard/[tenantSlug]/inventory with search, column filters, and a paginated data table
- Multi-step Product Creation Wizard with three steps: Step 1 collects basic product information, Step 2 generates the variant matrix from size and colour axes, Step 3 presents a review summary before final save
- Product Detail page at /dashboard/[tenantSlug]/inventory/[productId] with a three-tab layout covering Details, Variants, and Stock History
- Variant Edit Panel implemented as a ShadCN Sheet slide-in drawer within the Product Detail page, requiring no separate route
- Category Management page at /dashboard/[tenantSlug]/inventory/categories with a two-level tree and inline editing
- Brand Management page at /dashboard/[tenantSlug]/inventory/brands with logo upload and flat list management
- Bulk Price Update tool triggered from the Inventory List floating action bar when one or more product rows are selected
- Barcode label printing sheet generation accessible from both the Variants tab and the Inventory List, supporting 4 cm × 6 cm thermal labels and A4 fallback
- CSV Import interface at /dashboard/[tenantSlug]/inventory/import — a three-step flow: upload, column mapping, and preview-and-confirm
- CSV Export feature triggered from the Inventory List "Export" button, respecting active filter state and streaming from a server-side endpoint
- Product Image Upload component integrated into the Variant Edit Panel and the Variant Matrix table in the wizard
- Product search bar with 300 ms debounce and a collapsible filter bar covering category, brand, gender, and status filtering via URL search params

### Out of Scope

- Stock adjustment forms and stock take session UI — deferred to SubPhase 02.03
- POS cart integration and the checkout screen — deferred to Phase 03
- Purchase order creation and receiving flows — deferred to Phase 04
- Reporting dashboards and sales analytics — deferred to Phase 05
- Supplier management — deferred to a later phase
- Loyalty and promotions engine — not part of Phase 02

---

## Technical Context

All inventory pages live under the App Router path /dashboard/[tenantSlug]/inventory and inherit the espresso sidebar layout established in Phase 01. The layout shell provides the tenant context via a React context provider, which all child pages consume without additional prop drilling.

Data fetching follows the project-wide pattern: all reads use TanStack Query hooks with a staleTime of 30 seconds, and all writes use useMutation with query invalidation on success. The Zustand store is used only for transient UI state that must survive route transitions within the wizard (useProductWizardStore) and for tracking selected rows in the inventory list for bulk operations. Filter state is never stored in Zustand — URL search params are the single source of truth for all filter values.

Forms throughout this sub-phase use React Hook Form with a Zod resolver. Every form schema is co-located in a schemas/ directory next to the relevant page or component. Loading states use ShadCN Skeleton components, never spinners. Empty states use a friendly illustration with a descriptive heading and a call-to-action button.

RBAC permission gates are enforced in two places: the API route (returning 403 for unauthorized requests) and the UI layer (hiding or disabling buttons using the usePermission hook from Phase 01). The product:view_cost_price permission is the most sensitive — cost price must never be rendered in any component that a CASHIER role can reach, even as a hidden element.

Design tokens in use across this sub-phase:

| Token              | Hex     | Usage                                               |
| ------------------ | ------- | --------------------------------------------------- |
| --color-espresso   | #3A2D28 | Sidebar, primary buttons, headings                  |
| --color-terracotta | #A48374 | Hover highlights on table rows, drag-over states    |
| --color-sand       | #CBAD8D | Table headers, borders, active filter chips, tab underline |
| --color-mist       | #D1C7BD | Dividers, input borders, inactive wizard step pills |
| --color-linen      | #EBE3DB | Page background, card backgrounds                   |
| --color-pearl      | #F1EDE6 | Main content area, table row backgrounds            |

Typography rules: Playfair Display for all H1–H3 headings, Inter for all body text and UI labels, JetBrains Mono for SKUs, barcodes, and prices.

---

## Task List

| Task ID        | Task Name                              | Complexity | Depends On              |
| -------------- | -------------------------------------- | ---------- | ----------------------- |
| Task_02_02_01  | Build Inventory List Page              | Medium     | SubPhase_02_01 complete |
| Task_02_02_02  | Build Product Creation Wizard Step 1   | Medium     | Task_02_02_01           |
| Task_02_02_03  | Build Product Creation Wizard Step 2 Variants | High  | Task_02_02_02           |
| Task_02_02_04  | Build Product Detail Page              | High       | Task_02_02_03           |
| Task_02_02_05  | Build Variant Edit Panel               | Medium     | Task_02_02_04           |
| Task_02_02_06  | Build Category And Brand Management    | Low        | Task_02_02_01           |
| Task_02_02_07  | Build Bulk Price Update Tool           | Medium     | Task_02_02_05           |
| Task_02_02_08  | Build Barcode Label Printing           | Medium     | Task_02_02_04           |
| Task_02_02_09  | Build CSV Import Interface             | High       | Task_02_02_03           |
| Task_02_02_10  | Build CSV Export Feature               | Low        | Task_02_02_01           |
| Task_02_02_11  | Build Product Image Upload             | Medium     | Task_02_02_05           |
| Task_02_02_12  | Build Product Search And Filters       | Medium     | Task_02_02_01           |

---

## Validation Criteria

- The inventory list renders in under one second when the tenant has 100 or more products, measured from route navigation to first contentful paint
- The Product Creation Wizard completes all three steps and persists the product record along with all generated variants to the database in a single atomic transaction
- The Variant Matrix Generator produces all Size × Colour combinations automatically when both axes have at least one value defined
- The Product Detail page switches between the Details, Variants, and Stock History tabs without remounting or losing scroll position
- Category CRUD operations all work: creating a new category, renaming an existing one in-place, and soft-deleting a category — with a guard toast shown when deletion is attempted on a category that has associated products
- Brand CRUD operations all work with the same guard behaviour as categories
- Bulk price update applies the new pricing to all variants of every selected product and displays a success toast reporting the count of updated variants
- Barcode label PDF/print view renders 4 cm × 6 cm labels correctly with the brand, product name, SKU, barcode image, size/colour and retail price in the correct positions
- CSV import validates header presence, shows per-row validation errors in the preview table, and allows the user to skip error rows and import only valid ones
- CSV export downloads a file matching the current active filter state without requiring full page reload
- Image upload shows a progress indicator during upload, renders the thumbnail on success, and provides a client-side size validation error for files exceeding 5 MB before any request is made
- Search combined with category, brand, gender, and status filters correctly narrows the product list, and filter state persists on browser back-navigation
- CASHIER role cannot access the product creation wizard route, the category management page, or the brand management page — each returns a permission-denied redirect

---

## Files Created / Modified

### New Route Files (App Router)

| Path                                                              | Purpose                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| src/app/dashboard/[tenantSlug]/inventory/page.tsx                 | Inventory List page                        |
| src/app/dashboard/[tenantSlug]/inventory/new/page.tsx             | Product Creation Wizard (all 3 steps)      |
| src/app/dashboard/[tenantSlug]/inventory/[productId]/page.tsx     | Product Detail page                        |
| src/app/dashboard/[tenantSlug]/inventory/categories/page.tsx      | Category Management page                   |
| src/app/dashboard/[tenantSlug]/inventory/brands/page.tsx          | Brand Management page                      |
| src/app/dashboard/[tenantSlug]/inventory/import/page.tsx          | CSV Import interface                       |

### New API Route Files

| Path                                              | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| src/app/api/products/route.ts                     | GET (list with filters), POST (create)         |
| src/app/api/products/[id]/route.ts                | GET, PATCH, DELETE for single product          |
| src/app/api/products/bulk-price-update/route.ts   | POST — bulk price update endpoint              |
| src/app/api/products/import/route.ts              | POST — CSV import endpoint                     |
| src/app/api/products/export/route.ts              | GET — CSV export stream endpoint               |
| src/app/api/variants/[id]/route.ts                | PATCH, DELETE for single variant               |
| src/app/api/categories/route.ts                   | GET, POST for categories                       |
| src/app/api/categories/[id]/route.ts              | PATCH, DELETE for single category              |
| src/app/api/brands/route.ts                       | GET, POST for brands                           |
| src/app/api/brands/[id]/route.ts                  | PATCH, DELETE for single brand                 |
| src/app/api/upload/route.ts                       | POST — image upload handler                    |

### New Component Files

| Path                                                              | Purpose                                        |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| src/components/inventory/InventoryTable.tsx                       | Main product data table                        |
| src/components/inventory/ProductStatusBadge.tsx                   | Status badge for Active/Archived/Low Stock     |
| src/components/inventory/BulkActionBar.tsx                        | Floating action bar for bulk operations        |
| src/components/inventory/BulkPriceUpdateDialog.tsx                | Dialog for bulk price update                   |
| src/components/inventory/BarcodeLabelDialog.tsx                   | Barcode label print preview dialog             |
| src/components/inventory/BarcodeLabel.tsx                         | Single label layout component                  |
| src/components/inventory/InventoryFilterBar.tsx                   | Filter bar with category, brand, gender, status |
| src/components/inventory/ActiveFilterChips.tsx                    | Row of removable active filter chips           |
| src/components/wizard/WizardProgressBar.tsx                       | Three-step wizard progress indicator           |
| src/components/wizard/WizardStep1BasicInfo.tsx                    | Step 1 form for basic product information      |
| src/components/wizard/WizardStep2Variants.tsx                     | Step 2 variant matrix generator                |
| src/components/wizard/WizardStep3Review.tsx                       | Step 3 review and save                         |
| src/components/wizard/VariantMatrixTable.tsx                      | Generated size × colour combination table      |
| src/components/wizard/SizeChipInput.tsx                           | Size group selector and custom size chips      |
| src/components/wizard/ColourChipInput.tsx                         | Colour chip input                              |
| src/components/wizard/ApplyPricingRow.tsx                         | Bulk pricing shortcut row above matrix         |
| src/components/product/ProductDetailTabs.tsx                      | Three-tab layout for product detail            |
| src/components/product/ProductDetailsCard.tsx                     | Details tab content card                       |
| src/components/product/VariantsTab.tsx                            | Variants table within product detail           |
| src/components/product/StockHistoryTab.tsx                        | Stock movements table within product detail    |
| src/components/product/VariantRow.tsx                             | Expandable row in the variants table           |
| src/components/product/VariantEditSheet.tsx                       | Right-side Sheet for editing a single variant  |
| src/components/product/ProductImageUpload.tsx                     | Image upload grid component                    |
| src/components/product/TagInput.tsx                               | Tag chip input component                       |
| src/components/categories/CategoryTree.tsx                        | Two-level category tree with inline editing    |
| src/components/categories/InlineCategoryForm.tsx                  | Inline reveal form for adding a category       |
| src/components/brands/BrandsTable.tsx                             | Flat brands list table                         |
| src/components/brands/BrandEditSheet.tsx                          | Sheet for editing a brand                      |
| src/components/csv/CsvUploadZone.tsx                              | Drag-and-drop CSV upload area                  |
| src/components/csv/ColumnMappingTable.tsx                         | Field mapping step for CSV import              |
| src/components/csv/ImportPreviewTable.tsx                         | Row-by-row import preview with status badges   |

### New Hook Files

| Path                                              | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| src/hooks/useProducts.ts                          | TanStack Query hook for product list           |
| src/hooks/useProduct.ts                           | TanStack Query hook for single product         |
| src/hooks/useCategories.ts                        | TanStack Query hook for category list          |
| src/hooks/useBrands.ts                            | TanStack Query hook for brand list             |
| src/hooks/useVariantMutation.ts                   | useMutation hook for variant PATCH/DELETE      |
| src/hooks/useBulkPriceUpdate.ts                   | useMutation hook for bulk price update         |
| src/hooks/useCsvImport.ts                         | useMutation hook for CSV import POST           |

### New Store Files

| Path                                              | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| src/stores/productWizardStore.ts                  | Zustand store for wizard multi-step state      |
| src/stores/inventorySelectionStore.ts             | Zustand store for selected inventory row IDs   |

### New Schema / Type Files

| Path                                              | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| src/schemas/productSchema.ts                      | Zod schemas for product create and edit forms  |
| src/schemas/variantSchema.ts                      | Zod schemas for variant edit and matrix row    |
| src/schemas/bulkPriceSchema.ts                    | Zod schema for bulk price update payload       |
| src/schemas/csvImportSchema.ts                    | Zod schema for CSV import API payload          |
| src/types/inventory.ts                            | TypeScript interfaces for inventory UI types   |
