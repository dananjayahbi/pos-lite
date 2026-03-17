# Task 04.01.03 — Build Customer Management Pages

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.03 |
| Task Name | Build Customer Management Pages |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Prerequisites | 04.01.02 (Customer service layer) |
| Output | Customer list page, customer detail page, create/edit Sheet component |

---

## Objective

Build the full customer management section of the dashboard. This includes a paginated list page with filtering, a rich customer detail page with tabbed history, and a slide-out Sheet for creating and editing customers. All pages live under the existing `/dashboard/[tenantSlug]/` routing structure and respect the RBAC permissions established in SubPhase 01.02.

---

## Context

The customer pages follow the same layout and component patterns as other dashboard sections built in earlier phases. The list page uses TanStack Query to fetch from `GET /api/customers`, the detail page fetches from `GET /api/customers/[id]`, and mutations use `POST /api/customers` and `PATCH /api/customers/[id]`. Cache invalidation uses the `['customers', tenantSlug]` query key family. The `creditBalance` field uses `decimal.js` values from the API and must be rendered with `JetBrains Mono` font, green colouring for positive values and red for negative.

---

## Instructions

### Step 1: Build the Customer List API Route

Create `src/app/api/customers/route.ts` with a `GET` handler and a `POST` handler. The `GET` handler reads `search`, `tag`, `spendMin`, `spendMax`, `page`, and `limit` from `req.nextUrl.searchParams`, extracts `tenantId` from the authenticated session, and calls `getCustomers`. Return the paginated result as JSON. The `POST` handler reads the request body, validates it with a Zod schema (all Customer creation fields), extracts `tenantId` from the session, and calls `createCustomer`. Return the created customer with HTTP 201.

Create `src/app/api/customers/[id]/route.ts` with `GET`, `PATCH`, and `DELETE` handlers. `GET` calls `getCustomerById`. `PATCH` validates the body and calls `updateCustomer`. `DELETE` calls `softDeleteCustomer`. All handlers verify the session and tenant.

### Step 2: Build the Customer List Page

Create `src/app/dashboard/[tenantSlug]/customers/page.tsx` as a Client Component. Use TanStack Query's `useQuery` to fetch from `GET /api/customers` with the `tenantSlug` as part of the query key. Render a page header ("Customers") with an "Add Customer" button on the right and an "Import Customers" button adjacent to it.

Below the header, render a filter bar as a horizontal flex row containing: a text search input (debounced 400 ms using a `useState` + `useEffect` pattern), a tag filter dropdown (populated from a separate lightweight `GET /api/customers?distinct=tags` endpoint or hard-coded common tags for Phase 04), and a spend band select with options Any, Under Rs. 5,000, Rs. 5,000–25,000, Rs. 25,000+.

Render a ShadCN `Table` with the following columns:

| Column | Notes |
|---|---|
| Name | Plain text, clickable — navigates to detail page |
| Phone | Plain text |
| Tags | Rendered as a row of ShadCN `Badge` components using terracotta background |
| Credit Balance | JetBrains Mono, `text-green-700` when positive, `text-red-600` when negative, `text-muted-foreground` when zero |
| Total Spend | JetBrains Mono, always neutral colour |
| Last Purchase | Date of most recent sale, formatted as "DD MMM YYYY" or "—" if none |
| Actions | "View" button linking to detail page; "Edit" button opening the Sheet |

Add pagination controls below the table using ShadCN `Pagination` components driven by the `page` and `totalPages` values returned by the query.

### Step 3: Build the Customer Create/Edit Sheet

Create `src/components/customers/CustomerSheet.tsx` as a Client Component accepting `customer` (optional Customer for edit mode) and `onSuccess` (callback) props, plus a `open` and `onOpenChange` pair for controlled visibility. Use ShadCN `Sheet` with `SheetContent` on the right side.

Use React Hook Form with a Zod resolver. Define the schema matching the Customer creation/update fields. Include the following form controls:

- `name` — ShadCN `Input`, required.
- `phone` — `Input`, required, with a placeholder showing the expected format (`+94XXXXXXXXX`).
- `email` — `Input` type email, optional.
- `gender` — ShadCN `Select` with options MALE, FEMALE, OTHER.
- `birthday` — ShadCN date picker (use the existing date picker component from the project or the `react-day-picker` pattern used elsewhere). Stored as an ISO string, displayed in "DD/MM/YYYY" format.
- `tags` — a ShadCN `Command`-based combobox allowing multiple tag selection. Seed the options with common VelvetPOS tags: VIP, Regular, Wholesale, Staff, Online. Also allow free-text entry.
- `notes` — ShadCN `Textarea`, optional.

On submit, call the appropriate TanStack Query mutation (`POST` for create, `PATCH` for edit). On success, call `onSuccess` and close the Sheet. Show a ShadCN `toast` with "Customer saved successfully."

### Step 4: Build the Customer Detail Page

Create `src/app/dashboard/[tenantSlug]/customers/[customerId]/page.tsx`. Use TanStack Query to fetch the customer with history included. Render the following layout:

**Profile Header** — a large avatar circle displaying the customer's initials (first letter of first name + first letter of last name) filled with a muted terracotta gradient. Adjacent to the avatar: customer name in Playfair Display heading, phone number, email (if present), a row of tag badges, and an "Edit" button that opens the CustomerSheet in edit mode.

**Stats Cards** — a four-card horizontal row showing: Total Spend (JetBrains Mono), Avg Order Value (JetBrains Mono), Visit Count (plain number), and Credit Balance (JetBrains Mono, colour-coded green/red/neutral).

**Tabbed Content** — three ShadCN `Tabs`:

- Purchase History tab — a table of linked Sales with columns: Date, Receipt No., Items, Subtotal, Discount, Total, Payment Method. Rows are clickable and navigate to the sale detail view.
- Returns tab — a table of Returns with columns: Date, Return No., Items Returned, Refund Amount, Method.
- Edit tab — embeds the same CustomerSheet form fields inline (not in a Sheet overlay) for a more comfortable editing experience on the detail page.

### Step 5: Configure TanStack Query Cache Invalidation

On both the list page and the detail page, after any mutation (create, update, soft delete), call `queryClient.invalidateQueries({ queryKey: ['customers', tenantSlug] })`. This ensures the list page reflects the latest data immediately after a Sheet mutation closes. For the detail page's own query, use the key `['customers', tenantSlug, customerId]`. Invalidating the parent key `['customers', tenantSlug]` triggers a refetch of both the list and the detail because all keys sharing the prefix are invalidated by TanStack Query's hierarchical invalidation.

---

## Expected Output

- `src/app/api/customers/route.ts` — GET and POST handlers.
- `src/app/api/customers/[id]/route.ts` — GET, PATCH, DELETE handlers.
- `src/app/dashboard/[tenantSlug]/customers/page.tsx` — list page with filter bar and table.
- `src/app/dashboard/[tenantSlug]/customers/[customerId]/page.tsx` — detail page with stats and tabs.
- `src/components/customers/CustomerSheet.tsx` — create/edit Sheet with React Hook Form.

---

## Validation

- [ ] The customer list page loads, paginates correctly, and the search input filters results with a debounced 400 ms delay.
- [ ] The tag filter shows only customers tagged with the selected tag.
- [ ] Credit Balance renders green for positive, red for negative, and neutral for zero.
- [ ] Creating a customer via the Sheet reflects in the list immediately after closing.
- [ ] The detail page shows the last 20 sales in the Purchase History tab.
- [ ] Soft-deleting a customer from the list page removes them from the visible list (because the service filters `deletedAt: null`).

---

## Notes

- Credit Balance and Total Spend values arrive from the API as strings (Prisma serialises Decimal as string in JSON). Parse them with `new Decimal(value)` before performing any arithmetic in the frontend, and format for display using `value.toFixed(2)` prefixed with "Rs.".
- The birthday date picker must default to `undefined` rather than today's date in the add-customer form to prevent accidental birthday entries.
- The tag combobox should normalise all tags to upper-case on save so that tag filtering remains case-insensitive by convention.
