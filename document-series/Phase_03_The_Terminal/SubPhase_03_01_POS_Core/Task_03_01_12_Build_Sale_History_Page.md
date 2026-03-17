# Task 03.01.12 — Build Sale History Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.12 |
| Task Name | Build Sale History Page |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_03 |
| Output Files | src/app/dashboard/[tenantSlug]/pos/history/page.tsx, src/components/pos/SaleHistoryTable.tsx, src/components/pos/SaleDetailModal.tsx |

## Objective

Build the Sale History page accessible from the POS terminal's minimal top bar, providing cashiers and managers with a searchable, filterable table of all sales for the current tenant, a sale detail modal with full line-item breakdown, and an authorised void action for eligible transactions.

## Instructions

### Step 1: Set Up the Page Route and Layout

Create src/app/dashboard/[tenantSlug]/pos/history/page.tsx as a Next.js server component. Since this route falls within the /pos path segment, it inherits the POS terminal layout from the parent layout.tsx. This means there is no sidebar and no standard dashboard navigation. However, the history page should not show the full two-panel POS grid — it uses a full-width single-column layout that fills the left and right panels together.

At the top of the page, render a slim header bar matching the POS top bar style (espresso background, 48px height). On the left side of this bar, render a "← Return to Terminal" link in terracotta Inter text that navigates back to /dashboard/[tenantSlug]/pos. This link is prominent because cashiers may navigate to the history page to look up a receipt and need to return to the terminal quickly. On the right side, display the current tenant name and the cashier's name from the session.

Below the header, render the SaleHistoryTable client component, passing the tenantId and the current user's role as props. The page itself does not need to prefetch data — the client component will handle all data fetching via TanStack Query.

### Step 2: Build the Filter and Search Controls

At the top of SaleHistoryTable, render a filter bar with the following controls arranged horizontally. A date range picker showing "From" and "To" date inputs, defaulting the "From" value to today's date (midnight) and the "To" value to the current time, so the default view shows today's transactions. A "Cashier" dropdown select that lists all cashiers who have made sales in the tenant — populated by a secondary lightweight query to GET /api/users?role=CASHIER. A "Status" dropdown select with options: All, Completed, Voided, and Held (OPEN). A "Payment Method" dropdown with options: All, Cash, Card, Split. A "Reset Filters" text button that returns all filters to their defaults.

All filter changes trigger a re-query of the TanStack Query data by updating the query key with the new filter values. Use a debounce of 300ms on the date inputs to avoid triggering a new API call on every character typed into a date field. The filter state is managed in the SaleHistoryTable component's local state using a single filters object updated with partial merges.

### Step 3: Build the Sales Table

The main content area of SaleHistoryTable is a sortable TanStack Table (react-table) rendering all sales matching the current filters. The table uses server-side pagination: each filter change or page turn triggers a new GET /api/sales query with the updated parameters. Include a page size selector with options of 20, 50, and 100 rows per page.

Define the following table columns.

The Sale Reference column shows the first 8 characters of the sale id in uppercase JetBrains Mono at 12px, coloured espresso, and the full sale id as a title tooltip on hover. This cell is a clickable link that opens the SaleDetailModal.

The Date and Time column shows the createdAt value formatted as "DD MMM YYYY, HH:MM" (for example, "15 Mar 2026, 14:32") in Inter 13px. This column is sortable — clicking the header toggles ascending and descending createdAt order.

The Cashier column shows the cashier's full name in Inter 13px. If the sale was discount-authorised by a manager (authorizingManagerId is non-null), show a small terracotta "Mgr Override" badge beside the cashier name as a visual indicator.

The Lines column shows an integer count of the SaleLine records for the sale, styled as a centred Inter 13px number in a mist pill badge.

The Sub-total, Discount, and Tax columns show their respective monetary values in JetBrains Mono 12px right-aligned. The Discount column uses the danger colour when the value is greater than zero.

The Total column shows the sale's totalAmount in JetBrains Mono 14px espresso bold, right-aligned.

The Payment Method column renders a badge: CASH sales use the success colour (#2D6A4F) with white text, CARD sales use the info colour (#1D4E89) with white text, SPLIT sales use the secondary terracotta colour. Held sales (OPEN status) show no payment method badge, only the Status badge.

The Status column renders a badge: COMPLETED uses success colour, VOIDED uses danger colour (#9B2226), and OPEN (held) uses warning colour (#B7791F) with the label "Held".

The Actions column contains two conditional buttons. The "View" button (a small eye icon) is always present for all rows and opens the SaleDetailModal for that sale. The "Void" button (a small ban-circle icon in danger colour) is shown only when all of the following conditions are simultaneously true: the sale status is COMPLETED, the sale's shiftId matches the current cashier's OPEN shift id, and the current user has the pos:void_sale RBAC permission. If the user has no open shift (they are viewing history outside an active session), or if the sale belongs to a closed shift, or if the user is a CASHIER without the void permission, the Void button is hidden for that row.

### Step 4: Implement the Void Action Flow

When the Void button is clicked for a row, open a ShadCN AlertDialog (not a full modal) to confirm the void. The dialog title reads "Void Sale [SHORT_ID]?" and the description reads "This will reverse the sale and restore stock for all line items. This action cannot be undone." Below the description, include a text input labelled "Reason for void (optional):" allowing the manager to leave a brief annotation.

The "Confirm Void" button in the AlertDialog calls POST /api/sales/[id]/void. On success, update the row's status badge to VOIDED and disable the Void button using a TanStack Query cache invalidation and refetch. Show a success toast "Sale [SHORT_ID] has been voided and stock restored." On failure (for example, a 409 ConflictError because the shift has since closed), show a danger toast with the server's error message.

### Step 5: Build the SaleDetailModal

Create src/components/pos/SaleDetailModal.tsx as a client component using a ShadCN Dialog with max-width of 2xl (672px) and a scrollable content area. The modal is opened when a cashier clicks a Sale Reference cell in the history table.

The modal is divided into the following sections. The header shows "Sale [SHORT_ID]" in Playfair Display at 18px and the sale's createdAt timestamp. A metadata strip below the header shows: Cashier name, Shift reference (short shift id), Payment Method badge, and Status badge — all in a horizontal row of compact linen-background chips.

The line items section renders a compact table with columns: Product Name + Variant Description (two lines), SKU in JetBrains Mono, Unit Price, Qty, Discount, and Line Total. Each row displays the snapshot fields (productNameSnapshot and variantDescriptionSnapshot) rather than the live product data, correctly showing what was sold rather than the current product catalog state. The table uses alternating linen and pearl row backgrounds for readability.

Below the line items table, the discount breakdown section shows: Sub-total, Line Discounts (as a calculated sum of all per-line discountAmount values), Cart Discount (sale.discountAmount), Tax Amount, and Total Amount. If authorizingManagerId is non-null, add a small note below the totals reading "Cart discount authorised by [Manager Name]" retrieved by joining the manager's user record.

If the sale is VOIDED, show a prominent danger-coloured banner at the top of the modal reading "This sale was voided on [voidedAt date] by [voidedBy user name]." If whatsappReceiptSentAt is non-null, show a small success indicator reading "WhatsApp receipt sent at [time]."

A "Print Receipt" button and "Send WhatsApp Receipt" button appear in the modal footer — these are placeholders in Phase 3 that will be wired to the receipt system in SubPhase 03.02. Render them as disabled buttons with a tooltip "Available in the next update" so the UI structure is already in place.

## Expected Output

- src/app/dashboard/[tenantSlug]/pos/history/page.tsx as a server component with session auth and the SaleHistoryTable client component
- src/components/pos/SaleHistoryTable.tsx with filter controls, react-table configuration, server-side pagination, Void action with AlertDialog, and role-based column visibility
- src/components/pos/SaleDetailModal.tsx with snapshot-based line items table, discount breakdown, authorising manager annotation, void banner, and receipt action placeholders

## Validation

- Navigating to /dashboard/[tenantSlug]/pos/history shows today's sales in the table by default, ordered by createdAt descending
- Changing the Status filter to "Held" shows only OPEN Sale records for the tenant
- Clicking a Sale Reference cell opens the SaleDetailModal with the correct line items, snapshot names, and full financial breakdown
- The Void button is hidden for sales from closed shifts and for sales already marked VOIDED
- Clicking the Void button for an eligible sale shows the AlertDialog; confirming the void POSTs to /api/sales/[id]/void and updates the row status badge to VOIDED
- The "← Return to Terminal" link navigates back to the POS terminal page
- The SaleDetailModal shows the snapshot fields (productNameSnapshot, variantDescriptionSnapshot) for line items — not the current live product name

## Notes

- The history page inherits the POS layout but is intentionally read-heavy — it is designed for brief lookups (reprinting a receipt, checking a recent transaction, voiding a mistake) rather than extended management workflows. Long-running analysis and reporting are deferred to the Reporting phase.
- The "Mgr Override" badge on the Cashier column serves as a quick audit signal: managers reviewing the history table can immediately identify which transactions involved a discount override without opening each sale's detail modal.
- The snapshot display in the SaleDetailModal is a deliberate design principle reiterated here: the modal always shows what was sold, not what the product is called today. If product names or SKUs have changed since the sale, the modal still shows the original values, which is essential for customer disputes and receipt reprints.
- The disabled Print Receipt and Send WhatsApp Receipt buttons in the modal footer are important UI placeholder scaffolding: they communicate to the user that these features are coming, reduce support inquiries, and ensure the modal layout does not need to be restructured when SubPhase 03.02 implements them.
