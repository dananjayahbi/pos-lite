# Task 04.02.10 — Build Expense Logger

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.10 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 3–4 hours |
| Depends On | 04.02.01 (Expense model) |
| Produces | Expense list page, create expense form, expense detail sidebar, category summary row |
| Owner Role | Full-Stack Developer |

---

## Objective

Build the expense logging interface at /dashboard/[tenantSlug]/expenses. Managers and Owners can record business expenses with a category, amount, description, date, and optional receipt image. The page provides date and category filters, a per-category summary row, and a detail sidebar for viewing or editing individual expense entries.

---

## Context

The Expense model from task 04.02.01 carries category (ExpenseCategory enum), amount, description, receiptImageUrl, recordedById, and expenseDate. Seven expense categories are supported: RENT, SALARIES, UTILITIES, ADVERTISING, MAINTENANCE, MISCELLANEOUS, and OTHER. Receipt images are uploaded via a presigned URL pattern — the client requests an upload URL from the server, uploads the file directly to object storage (S3-compatible), and stores only the URL in the database, keeping the API route lightweight.

---

## Instructions

### Step 1: Create the Expenses API Routes

Create src/app/api/expenses/route.ts with a GET handler and a POST handler. The GET handler accepts optional query parameters: category (ExpenseCategory), dateFrom, dateTo, page, and pageSize. It queries Expense records for the tenant filtered by the provided parameters and returns paginated results with the recordedBy user's name included. The POST handler accepts category, amount, description, expenseDate, and optionally receiptImageUrl in the request body, validated with Zod. Set recordedById to the session user's ID. Restrict both handlers to MANAGER and OWNER roles.

### Step 2: Create the Expense Detail API Route

Create src/app/api/expenses/[id]/route.ts with a GET handler and a PATCH handler. GET returns the full expense record. PATCH accepts category, amount, description, expenseDate, and receiptImageUrl as optional fields for editing. Both methods restrict to MANAGER and OWNER.

### Step 3: Create the Receipt Upload Route

Create src/app/api/expenses/upload-url/route.ts with a GET handler that accepts a fileName and mimeType query parameter. Validate that mimeType is one of image/jpeg, image/png, or image/webp. Generate a presigned PUT URL targeting the tenant's receipts folder in object storage, with a key pattern of receipts/[tenantId]/[uuid].[ext]. Set the presigned URL expiry to 300 seconds. Return the presigned URL and the final object URL to store in receiptImageUrl. This route follows the same presigned URL pattern used for product images in Phase 02.

### Step 4: Build the Expenses Page Shell

Create src/app/dashboard/[tenantSlug]/expenses/page.tsx as a server component. Render the page header with the title "Expenses" in Playfair Display. Include a navigation tab row beneath the header with two tabs: "Expense Log" (current page) and "Cash Flow Statement" (linking to the cash flow sub-route added in task 04.02.11). Render two filter controls: a ShadCN Select for category (showing all seven options plus "All Categories" as default) and a date range picker. Render a summary bar above the table showing the total expense amount for the current filter state in a highlighted chip.

### Step 5: Build the Expenses Table Component

Create src/app/dashboard/[tenantSlug]/expenses/components/ExpensesTable.tsx as a client component. Render a ShadCN Table with columns: Date, Category (as a coloured badge), Description, Amount, Receipt (a link icon that opens the receiptImageUrl in a new tab, or a dash if none), Recorded By, and Actions. Format the Date column as a short date string (e.g., 17 Mar 2026) using the tenant's locale settings. Format Amount as currency using the tenant's currency setting. Category badges use a fixed colour scheme — RENT in terracotta, SALARIES in espresso/pearl, UTILITIES in mist, ADVERTISING in sand, MAINTENANCE in linen/espresso, MISCELLANEOUS and OTHER in pearl/espresso.

### Step 6: Build the Category Summary Row

At the bottom of the ExpensesTable, add a visually distinct summary row that is always visible and not scrolled with the rest of the table. The summary row spans all columns and shows: "Total for filters: [totalAmount]" on the left and a per-category breakdown as small chips — for example, "Rent: $1,200 · Utilities: $450 · ..." — on the right. This row uses a sand (#CBAD8D) background and Playfair Display for the total figure.

### Step 7: Build the Create Expense Form

Create src/app/dashboard/[tenantSlug]/expenses/components/CreateExpenseModal.tsx as a client component. Render a ShadCN Dialog containing a form with: Category (Select), Amount (number input with currency prefix), Description (textarea), Expense Date (DatePicker defaulting to today), and Receipt Image (file input). The file input triggers the upload flow: on file selection, request a presigned URL from the upload route, upload the file directly from the browser to the presigned URL using a PUT request, then store the returned object URL in a hidden form field. Show a progress indicator during the upload. On submission, call POST /api/expenses and invalidate the expenses query.

### Step 8: Build the Expense Detail Sidebar

Create src/app/dashboard/[tenantSlug]/expenses/components/ExpenseDetailSheet.tsx as a client component rendered as a ShadCN Sheet. The Actions column in the table includes a "View" button that opens this sheet for the selected expense. Display all expense fields in a read-only view. Include an "Edit" toggle at the top of the sheet that converts the view into an editable form using the same field structure as the create form. On save, call PATCH /api/expenses/[id]. If a receiptImageUrl is set, render the image inline in the sheet with a maximum height of 200 pixels and a "View Full Size" link.

---

## Expected Output

- GET /api/expenses returns filtered, paginated expense records
- POST /api/expenses creates a new expense and assigns the session user as recordedBy
- The expenses page renders a filterable table with category badges and a summary row
- The create modal handles receipt image upload via presigned URL before form submission
- The expense detail sheet displays and allows editing of existing records

---

## Validation

- Create an expense with a receipt image — confirm the image is uploaded to object storage and the receiptImageUrl is stored correctly in the database
- Filter by category "RENT" — confirm only rent expenses appear and the total updates
- Apply a date range filter — confirm only expenses within the range appear
- Edit an existing expense from the detail sheet — confirm the changes persist
- Navigate to the page as a CASHIER — confirm the RBAC guard redirects appropriately

---

## Notes

- Expense amounts must always be stored as positive Decimal values. The Expense model records costs, not offsets. Negative expense amounts are not meaningful and the form should reject them with a validation error.
- If object storage is not configured in the current environment, the upload route should return a structured error and the receipt field should be optional in the form — the expense can still be created without a receipt. Document this degraded mode in a comment in the upload route.
