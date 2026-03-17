# Task 01.03.04 — Build Tenant Detail Page

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_03 (Tenant Management Page complete), Task_01_03_07 (Tenant Service Layer complete)

## Objective

Build the individual tenant detail page at src/app/(superadmin)/tenants/[tenantId]/page.tsx that displays full tenant information, subscription and invoice history, a readable settings preview, and administrative action buttons for manually controlling tenant status.

## Instructions

### Step 1: Create the Dynamic Route File

Create the file at src/app/(superadmin)/tenants/[tenantId]/page.tsx. The [tenantId] segment in the directory name is a Next.js dynamic segment — the page component will receive params.tenantId from Next.js automatically. This file is a Server Component. At the top of the function, read params.tenantId and call getTenantById from tenant.service.ts passing this value. If getTenantById returns null — meaning no tenant with that ID exists — call the Next.js notFound() function to render the 404 page.

### Step 2: Build the Page Navigation and Header

The topmost element on the page is a back link styled as a small text link with a left-pointing chevron icon. The link points to /superadmin/tenants and is labelled "Back to Tenants". Directly below it, render a two-column header row: the left column contains the store name in Playfair Display heading style and below it the tenant's slug in a small mono-spaced muted text. The right column is right-aligned and contains the TenantStatusBadge component showing the tenant's current status with its colour coding.

### Step 3: Build the Information Card Grid

Below the header, render a responsive grid of information cards (two or three columns on desktop). Each card is a ShadCN Card component with a pearl background. The cards to include are: Subscription Plan (the name of the plan linked to the tenant's active subscription, or "None" if no active subscription exists); Billing Status (the subscription's status value); Next Renewal Date (the subscription's nextBillingDate formatted as a human-readable date); Grace Period Expiry (visible only if the tenant status is GRACE_PERIOD — shows graceEndsAt formatted as a date, or a dash if null); Store Slug (the subdomain value); Custom Domain (the customDomain value or "Not configured" if null); and Created Date (the tenant's createdAt formatted with month, day, and year). Each card has a small muted label text above the value.

### Step 4: Build the Recent Invoices Table

Below the info cards, add a section with an h2 heading "Invoices" in Inter semi-bold. The table columns are: Invoice Number, Billing Date, Amount (formatted with the LKR currency symbol), Status (a colour-coded badge using InvoiceStatus: PAID is success-green, UNPAID is warning-amber, OVERDUE is danger-red), and a PDF column showing a download link when pdfUrl is present or a "Pending" text when it is not. If the tenant has no invoices yet, display an empty state message: "No invoices found for this tenant." The invoices data comes from the getTenantById result, which includes the most recent invoices sorted by billingDate descending.

### Step 5: Build the Admin Actions Section

Add a section with an h2 heading "Admin Actions" below the invoices table. Admin actions are grouped in a flex-wrap row. Each action is a ShadCN Button with an appropriate visual variant. The available actions are: Manual Suspend (a danger-variant button labelled "Suspend Tenant" — only visible when the current status is ACTIVE or GRACE_PERIOD); Manual Reactivate (a primary espresso button labelled "Reactivate Tenant" — only visible when the current status is SUSPENDED or CANCELLED); Trigger Grace Period (a warning-variant button labelled "Trigger Grace Period" — visible for testing purposes only when the current status is ACTIVE); Export Tenant Data (a secondary outline button labelled "Export Data" — currently a placeholder that shows a toast saying "Coming in Phase 5"); and View Audit Log (a ghost-variant button labelled "Audit Log" — opens a right-side drawer showing recent AuditLog entries filtered to this tenant's ID).

### Step 6: Wrap Destructive Actions in ConfirmDialog

For any action that changes the tenant's status — specifically Manual Suspend and Trigger Grace Period — wrap the button trigger inside a ConfirmDialog component from src/components/shared/ConfirmDialog.tsx. The dialog must display a clear description of what will happen. For suspend, the message is: "Suspending this tenant will immediately block all store users from accessing the platform. Are you sure?" For trigger grace period, the message is: "This will set the tenant status to GRACE_PERIOD and start a grace period countdown. Are you sure?" The confirmation button in the dialog is the only element that fires the API call.

### Step 7: Implement the Admin Action API Calls

Each action button calls a dedicated API route via a client-side fetch. Since the action buttons are interactive, extract the Admin Actions section into a Client Component at src/components/superadmin/TenantAdminActions.tsx. This component receives the tenant's id and current status as props. Each action calls the appropriate endpoint: POST /api/superadmin/tenants/[id]/suspend for suspend, POST /api/superadmin/tenants/[id]/reactivate for reactivate, and POST /api/superadmin/tenants/[id]/grace-period for triggering grace. On success, each call uses the Next.js router.refresh() method to cause the Server Component page to re-fetch updated data from the database without a full page navigation.

### Step 8: Build the Store Settings Preview

Below the admin actions, add a section with an h2 heading "Store Settings". Parse the tenant's settings JSON field and render each key as a two-column definition-list row: the key name on the left in a muted label style and the value on the right in readable text. The keys to display are currency, timezone, vatRate (shown as a percentage with the % symbol appended), ssclRate (similarly shown with %), and receiptFooter (shown as a quoted block). If the settings JSON is empty or null, display a message indicating no settings have been configured.

## Expected Output

- src/app/(superadmin)/tenants/[tenantId]/page.tsx is a complete Server Component
- src/components/superadmin/TenantAdminActions.tsx is a Client Component handling all action API calls
- The page displays complete tenant data including subscription state, invoice history, and settings
- Admin action buttons respect the tenant's current status and only show contextually appropriate options
- Destructive status-changing actions display a confirmation dialog before executing
- After any action completes, the page reflects the updated tenant state

## Validation

- [ ] Navigating to /superadmin/tenants/[validId] renders the full detail page without errors
- [ ] Navigating to /superadmin/tenants/[invalidId] renders the Next.js 404 page
- [ ] The info card grid shows all seven data points with correct values
- [ ] The invoice table renders all invoices with correct status colours
- [ ] "Suspend Tenant" button appears only when the status is ACTIVE or GRACE_PERIOD
- [ ] "Reactivate Tenant" button appears only when the status is SUSPENDED or CANCELLED
- [ ] The ConfirmDialog appears before executing Suspend or Trigger Grace Period
- [ ] After a successful status change, the page status badge updates to reflect the new status
- [ ] The settings preview renders all JSON keys in a readable format
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

The router.refresh() call after admin actions is intentional and is the recommended App Router pattern for causing a server component to re-fetch its data following a mutation. It does not cause a full page navigation — it reruns the server component fetch and diffs the result into the existing React tree. This keeps the user at the same scroll position and DOM state while ensuring the displayed data reflects the latest database values.
