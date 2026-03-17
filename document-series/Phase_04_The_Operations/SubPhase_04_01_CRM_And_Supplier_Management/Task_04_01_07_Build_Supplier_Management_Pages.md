# Task 04.01.07 — Build Supplier Management Pages

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.07 |
| Task Name | Build Supplier Management Pages |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Prerequisites | 04.01.01 (Supplier model migrated) |
| Output | Supplier list page, supplier service, supplier API routes |

---

## Objective

Build the supplier management section of the dashboard. Staff can view all suppliers in a paginated list, add new suppliers via a slide-out Sheet, edit existing supplier details, and archive suppliers that are no longer in use. All operations are tenant-scoped and the supplier list feeds into the Purchase Order creation flow.

---

## Context

Supplier management is a relatively straightforward CRUD section. The Sheet pattern follows the same conventions as the Customer Sheet from Task 04.01.03. No separate supplier detail page is built at this stage — editing is handled entirely within the Sheet. The supplier list page is the entry point from which staff also navigate to the Purchase Orders section.

---

## Instructions

### Step 1: Create the Supplier Service

Create `src/lib/services/supplier.service.ts`. Export the following functions:

- `createSupplier(tenantId, data)` — `data` contains `name`, `contactName`, `phone`, `whatsappNumber`, `email`, `address`, `leadTimeDays`, `notes`. Validate that `phone` matches the required format using a Regex (see Step 2). If `whatsappNumber` is not provided, default it to the same value as `phone`. Call `prisma.supplier.create` and return the result.

- `updateSupplier(tenantId, supplierId, data)` — verify tenant ownership, validate phone format if `phone` is being changed, call `prisma.supplier.update`.

- `getSuppliers(tenantId, options)` — options: `search` (matched against `name` and `contactName`), `page`, `limit`. Return `{ suppliers, total, page, totalPages }`. Exclude archived suppliers (where `isActive` is false) by default unless `includeArchived: true` is passed.

- `getSupplierById(tenantId, supplierId)` — fetch with tenant ownership check; include `purchaseOrders` count via `_count`. Throw if not found.

- `archiveSupplier(tenantId, supplierId)` — set `isActive: false`. Does not delete. Return the updated record.

### Step 2: Define Phone Number Validation

In the supplier service (and reuse it in the customer service if applicable), define a phone validation regex that accepts both international format `+94XXXXXXXXX` (Sri Lanka country code followed by 9 digits) and local format `07XXXXXXXX` (10 digits starting with 07). The regex pattern is: a string that either starts with `+94` followed by exactly 9 digits, or starts with `07` followed by exactly 8 digits. If the phone fails this check in `createSupplier` or `updateSupplier`, throw a validation error with the message "Phone number must be in +94XXXXXXXXX or 07XXXXXXXX format".

Export this regex from the service file (or from a shared `src/lib/validation.ts` if such a file exists) so it can be reused in the Zod schema for the supplier form.

### Step 3: Build the Supplier API Routes

Create `src/app/api/suppliers/route.ts` with:
- `GET` — calls `getSuppliers` using `tenantId` from session and query params for `search`, `page`, `limit`.
- `POST` — validates body with Zod, calls `createSupplier`, returns HTTP 201.

Create `src/app/api/suppliers/[id]/route.ts` with:
- `PATCH` — validates body, calls `updateSupplier`.

Create `src/app/api/suppliers/[id]/archive/route.ts` with:
- `PATCH` — calls `archiveSupplier`. No body required.

All routes validate the session and extract `tenantId`. Return typed error responses for not-found and validation cases.

### Step 4: Build the Supplier Form Sheet

Create a `SupplierSheet.tsx` component in `src/components/suppliers/`. The Sheet accepts `supplier` (optional, for edit mode), `open`, `onOpenChange`, and `onSuccess` props.

Use React Hook Form with Zod resolver. The Zod schema enforces `name` required, `phone` required with the phone regex, all other fields optional. Form fields:

- `name` — Input, required.
- `contactName` — Input, optional placeholder "Primary contact person".
- `phone` — Input, required, placeholder "+94XXXXXXXXX or 07XXXXXXXX".
- `whatsappNumber` — Input, optional, with a small helper text "Leave blank to use the same number as Phone".
- `email` — Input type email, optional.
- `address` — Textarea, optional.
- `leadTimeDays` — number Input, default value 7, labelled "Lead Time (days)".
- `notes` — Textarea, optional.

On submit, call the appropriate TanStack Query mutation. On success, show a toast "Supplier saved." and call `onSuccess`.

### Step 5: Build the Supplier List Page

Create `src/app/dashboard/[tenantSlug]/suppliers/page.tsx` as a Client Component. The page has a header "Suppliers" with an "Add Supplier" button on the right.

Below the header, a search input (debounced 400 ms) for filtering by name or contact name.

A ShadCN Table with the following columns:

| Column | Notes |
|---|---|
| Name | Clickable — but since there is no separate detail page, clicking opens the edit Sheet |
| Contact | `contactName` field |
| Phone | Plain text |
| WhatsApp | WhatsApp number; if same as Phone, show "Same as phone" |
| Lead Time | N days badge using muted style |
| PO Count | Number of purchase orders for this supplier from `_count`; links to PO list filtered by supplier |
| Actions | "Edit" opens Sheet; "Archive" shows confirm dialog then soft-archives |

When "Archive" is clicked, show a ShadCN `AlertDialog` with the message "Archive [Name]? They will no longer appear in new purchase order selections. Existing POs are not affected." with "Archive" and "Cancel" buttons.

Include a navigation banner or a section header under the page title linking to "Purchase Orders →" for quick navigation to the PO list.

---

## Expected Output

- `src/lib/services/supplier.service.ts` — five exported functions.
- `src/app/api/suppliers/route.ts` — GET and POST.
- `src/app/api/suppliers/[id]/route.ts` — PATCH.
- `src/app/api/suppliers/[id]/archive/route.ts` — PATCH archive.
- `src/components/suppliers/SupplierSheet.tsx` — form Sheet.
- `src/app/dashboard/[tenantSlug]/suppliers/page.tsx` — list page.

---

## Validation

- [ ] Creating a supplier with a phone in `07XXXXXXXX` format succeeds.
- [ ] Creating a supplier with a phone in `+94XXXXXXXXX` format succeeds.
- [ ] Creating a supplier with `phone: "123456"` returns a validation error with the correct message.
- [ ] The supplier form defaults `whatsappNumber` to `phone` when the WhatsApp field is left blank on save.
- [ ] Archiving a supplier removes them from the list page (because `includeArchived` defaults to false).
- [ ] The PO Count column correctly reflects the number of purchase orders linked to each supplier.

---

## Notes

- The phone validation regex is a business rule specific to Sri Lanka. If the application is ever extended to other markets, this regex should be extracted to a tenant-configurable setting. For Phase 04, hard-code the Sri Lanka formats.
- The supplier archive confirmation dialog should include a warning if the supplier has open POs (status DRAFT or SENT) — check `supplier._count.purchaseOrders` against open statuses by fetching `getSupplierById` before confirming the archive. This is a UI-level warning, not a database constraint.
- WhatsApp dispatch for POs (Task 04.01.11) will use `supplier.whatsappNumber` — ensuring this field is always populated (either explicitly or defaulting to phone) is important for that feature to work without null checks.
