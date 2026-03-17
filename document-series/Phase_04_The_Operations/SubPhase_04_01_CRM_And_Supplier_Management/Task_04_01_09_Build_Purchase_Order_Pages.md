# Task 04.01.09 — Build Purchase Order Pages

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.09 |
| Task Name | Build Purchase Order Pages |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Prerequisites | 04.01.08 (PO service), 04.01.07 (Supplier pages) |
| Output | PO list page, PO detail page, new PO form page, PO API routes |

---

## Objective

Build all Purchase Order facing pages and their backing API routes. Staff need to create new POs, view the current list with status filtering, access a detailed view of any PO, and trigger the status-advancing actions (send via WhatsApp, receive goods, cancel) from the detail page. The detail page is the operational hub for a PO's lifecycle.

---

## Context

The PO pages live under `/dashboard/[tenantSlug]/suppliers/purchase-orders/`. This is a sub-route of the suppliers section to reflect the logical grouping of supplier-related operations. The list page is accessible from the Supplier list page via a navigation link, and also directly from the sidebar navigation if one exists for the tenant dashboard.

---

## Instructions

### Step 1: Build the PO API Routes

Create `src/app/api/purchase-orders/route.ts` with:
- `GET` — calls `getPOs(tenantId, { supplierId, status, from, to, page, limit })` using query parameters. Returns the paginated PO list with supplier name and line count.
- `POST` — validates body with Zod (fields: `supplierId`, `lines` array, `expectedDeliveryDate` optional, `notes` optional), calls `createPO`, returns HTTP 201 with the created PO.

Create `src/app/api/purchase-orders/[id]/route.ts` with:
- `GET` — calls `getPOById`, returns the full PO with all lines and supplier info.
- `PATCH` — for status updates other than receiving (e.g., `DRAFT` → `SENT` manually or cancel). Validates the body contains a `status` field, calls `updatePOStatus`.

Create `src/app/api/purchase-orders/[id]/receive/route.ts` with:
- `POST` — validates the `receivedLines` array in the request body (each entry must have `lineId`, `receivedQty`, optional `actualCostPrice`), calls `receivePOLines`, and returns the updated PO with the `costPricesChanged` array in the response body.

Create `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts` — described in Task 04.01.11; stub it as a placeholder returning HTTP 501 for now.

All routes authenticate via session and validate tenant ownership.

### Step 2: Build the PO List Page

Create `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/page.tsx` as a Client Component. Use TanStack Query to fetch from `GET /api/purchase-orders`.

Page header: "Purchase Orders" with a "New Purchase Order" button on the right linking to the new PO page.

Filter bar (horizontal row): a supplier dropdown (populated from `GET /api/suppliers?limit=100`), a status filter select (All / DRAFT / SENT / PARTIALLY_RECEIVED / RECEIVED / CANCELLED), and a date range picker (from / to).

A ShadCN Table with columns:

| Column | Notes |
|---|---|
| PO Reference | Last 8 characters of the PO `id` prefixed with "PO-", displayed in JetBrains Mono; link to detail page |
| Supplier | Supplier name |
| Status | ShadCN `Badge` with colour coding: DRAFT = muted grey, SENT = blue, PARTIALLY_RECEIVED = amber, RECEIVED = green, CANCELLED = red/strikethrough |
| Lines | Count of lines |
| Total Amount | JetBrains Mono, "Rs. X.XX" |
| Expected Delivery | Formatted date or "—" |
| Created | Date |
| Actions | "View" links to detail page |

### Step 3: Build the New PO Form Page

Create `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/new/page.tsx`. This is a Client Component with a two-column layout (on larger screens): a form on the left and a live order summary panel on the right.

**Form fields:**

- Supplier select — a SearchableSelect component populated from `GET /api/suppliers`. Required.
- Expected Delivery Date — date picker, optional.
- Notes — Textarea, optional.
- PO Lines section — a dynamic list managed with React Hook Form's `useFieldArray`. Each line consists of:
  - A variant search input (debounced, calls `GET /api/products/variants?search=...`), showing product name and variant description in the dropdown results.
  - Ordered Qty — number input, minimum 1.
  - Expected Cost Price — number input, formatted as a decimal. Pre-filled from the variant's current `costPrice` when a variant is selected.
  - A remove line button (× icon).
- An "Add Line" button that appends a new empty line to the field array.

**Summary panel (right column):**
- Lists each added line as a row: variant name, qty × cost.
- Shows running total at the bottom, computed live in the browser using `decimal.js`.
- A "Create Purchase Order" submit button.

On submit, validate the form (at least one line, all lines have a valid variant and qty), call the `POST /api/purchase-orders` mutation. On success, show a toast "Purchase Order created as DRAFT." and navigate to the new PO's detail page.

### Step 4: Build the PO Detail Page

Create `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx`. Fetch with TanStack Query using key `['purchase-order', tenantSlug, poId]`.

**Header section:**
- PO Reference (e.g., "PO-A1B2C3D4") in JetBrains Mono at heading size.
- Status badge prominently displayed with colour coding from Step 2.
- Supplier name, contact, phone in a flex row.
- Expected Delivery date.
- Total Amount in JetBrains Mono.

**PO Lines table:**

| Column | Notes |
|---|---|
| Product | `productNameSnapshot` + `variantDescriptionSnapshot` |
| Ordered Qty | Grey text |
| Received Qty | Green text; shown as "N / M" where N = received and M = ordered |
| ✓ Full | Checkmark badge if `isFullyReceived` |
| Expected Cost | JetBrains Mono |
| Actual Cost | JetBrains Mono, shown only if `actualCostPrice` is not null |

**Action buttons (rendered conditionally based on PO status):**

- When status is `DRAFT`: "Send via WhatsApp" (calls `POST /api/purchase-orders/[id]/send-whatsapp`), "Cancel PO" (shows confirm dialog, then calls `PATCH /api/purchase-orders/[id]` with `status: CANCELLED`).
- When status is `SENT` or `PARTIALLY_RECEIVED`: "Receive Goods" (opens `GoodsReceivingModal` — built in Task 04.01.10), "Cancel PO".
- When status is `RECEIVED`: a read-only indicator "All goods received" with no actionable buttons.
- When status is `CANCELLED`: a read-only indicator "Cancelled" with no actionable buttons.

The "Cancel PO" action triggers a ShadCN `AlertDialog` with a warning that the cancellation is irreversible.

---

## Expected Output

- `src/app/api/purchase-orders/route.ts` — GET and POST.
- `src/app/api/purchase-orders/[id]/route.ts` — GET and PATCH.
- `src/app/api/purchase-orders/[id]/receive/route.ts` — POST.
- `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts` — stub (HTTP 501).
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/page.tsx` — PO list.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/new/page.tsx` — new PO form.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx` — PO detail.

---

## Validation

- [ ] The PO list page shows correct status badges and filters operate correctly.
- [ ] Creating a new PO via the form with two lines creates the database record with the correct `totalAmount`.
- [ ] The new PO form pre-fills `expectedCostPrice` from the variant's current `costPrice` when a variant is selected.
- [ ] The detail page renders all lines with the correct received/ordered display.
- [ ] "Cancel PO" on a DRAFT PO sets the status to CANCELLED and the action buttons disappear.
- [ ] Navigating to a RECEIVED PO detail page shows no actionable buttons.

---

## Notes

- The PO Reference short display ("PO-" + last 8 chars of cuid) must be read-only — the full `id` (cuid) is what is stored in the database and used in all API calls. The short form is purely for human readability.
- The variant search in the new PO form should use a 300 ms debounce and show at least the product name, a variant colour/size badge, the current `costPrice`, and current `stockQuantity` to help staff make informed ordering decisions.
- The "Send via WhatsApp" button on the detail page shows a loading spinner while the API call is in progress. If it succeeds, the status badge updates from DRAFT to SENT via query invalidation. If it fails, a toast error appears (detailed handling is in Task 04.01.11).
