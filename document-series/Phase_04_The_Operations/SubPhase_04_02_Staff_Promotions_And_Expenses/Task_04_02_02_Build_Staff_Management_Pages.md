# Task 04.02.02 — Build Staff Management Pages

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.02 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 3–4 hours |
| Depends On | 04.02.01 (schema migration complete) |
| Produces | Staff list page, staff detail page with tabbed navigation |
| Owner Role | Full-Stack Developer |

---

## Objective

Build the staff management section of the operations dashboard, giving Managers and Owners a centralised place to view, create, and manage staff accounts. The staff list page presents all users for the tenant with role badges and active/inactive status. The staff detail page provides a tabbed interface covering the staff member's profile, PIN management, commission history, and time clock history. All pages must respect RBAC — CASHIER and STOCK_CLERK roles do not have access.

---

## Context

The User model exists from Phase 01 and already carries name, email, role, hashedPin, isActive, and tenantId fields. The commissionRate and clockedInAt fields added in task 04.02.01 must be surfaced in the detail page. The four tabs on the detail page each delegate to a child component — only the Profile tab contains implementation in this task; PIN Management, Commission History, and Time Clock History are implemented in tasks 04.02.03, 04.02.05, and 04.02.06 respectively, but the tab shell must be scaffolded here.

---

## Instructions

### Step 1: Create the Staff List API Route

Create src/app/api/staff/route.ts with a GET handler and a POST handler. The GET handler reads the tenantId from the authenticated session, queries all User records for that tenant ordered by createdAt descending, and returns the id, name, email, role, isActive, commissionRate, clockedInAt, and createdAt fields. Do not return hashedPin or any authentication credential fields. The POST handler accepts name, email, role, and optionally commissionRate in the request body, creates a new User record with a generated temporary password (the user will set their PIN separately), and returns the created record. Validate that role is one of OWNER, MANAGER, CASHIER, or STOCK_CLERK — SUPER_ADMIN may not be created through this route.

### Step 2: Create the Staff Detail API Route

Create src/app/api/staff/[id]/route.ts with a GET handler and a PATCH handler. The GET handler returns the full staff profile including commissionRate and clockedInAt but excludes hashedPin. The PATCH handler accepts name, email, role, isActive, and commissionRate as optional fields and updates the User record accordingly. Enforce that only MANAGER and OWNER roles in the session may call PATCH. Use Zod for request body validation on both POST and PATCH.

### Step 3: Build the Staff List Page Shell

Create src/app/dashboard/[tenantSlug]/staff/page.tsx as a server component. Import and use the TanStack Query hydration pattern established in Phase 01 to prefetch the staff list. Render a page header in Playfair Display with the title "Staff" and a subtitle showing the total staff count. Include a "New Staff Member" button aligned to the right of the header — this button opens the create staff modal defined in step 5. Restrict the page to OWNER and MANAGER roles using the RBAC guard from Phase 01.

### Step 4: Build the Staff Table Component

Create src/app/dashboard/[tenantSlug]/staff/components/StaffTable.tsx as a client component. Use a ShadCN Table with columns for Name, Email, Role, Status, Commission Rate, and Actions. Render the Role value as a coloured badge: OWNER uses the espresso (#3A2D28) background with pearl (#F1EDE6) text, MANAGER uses terracotta (#A48374) with linen (#EBE3DB) text, CASHIER uses sand (#CBAD8D) with espresso text, and STOCK_CLERK uses mist (#D1C7BD) with espresso text. Render the Status column as a ShadCN Switch that calls the PATCH endpoint to toggle isActive. Render the Actions column with a "View" link that navigates to the staff detail page at /dashboard/[tenantSlug]/staff/[staffId]. Use TanStack Query's useMutation for the isActive toggle with optimistic updates.

### Step 5: Build the Create Staff Modal

Create src/app/dashboard/[tenantSlug]/staff/components/CreateStaffModal.tsx as a client component. Use a ShadCN Dialog containing a form with fields for Name (text), Email (email), Role (ShadCN Select), and Commission Rate (number input, visible only when Role is CASHIER). All fields are validated with react-hook-form and Zod. On successful submission, invalidate the staff list query and close the modal.

### Step 6: Build the Staff Detail Page Shell

Create src/app/dashboard/[tenantSlug]/staff/[staffId]/page.tsx as a server component. Fetch the staff member's profile from the API at build-request time. Render a breadcrumb trail: Dashboard → Staff → [Staff Name]. Render the staff member's name in Playfair Display as the page heading and their role badge beneath it. Below the heading, render a ShadCN Tabs component with four tab labels: Profile, PIN Management, Commission History, and Time Clock History. Each tab renders its corresponding child component, imported from the components subdirectory.

### Step 7: Build the Profile Tab Component

Create src/app/dashboard/[tenantSlug]/staff/[staffId]/components/ProfileTab.tsx as a client component. Display the staff member's name, email, role, isActive status (as a badge), commissionRate (formatted as a percentage with two decimal places), and clockedInAt (showing "Currently clocked in since [time]" when present or "Not clocked in" when null). Include an Edit Profile button that opens an inline edit form for name, email, role, and commissionRate. Use useMutation to call the PATCH endpoint and invalidate the staff detail query on success.

### Step 8: Scaffold Placeholder Tabs

For each of the three remaining tab components — PinManagement, CommissionHistory, and TimeClockHistory — create a placeholder file in the same components directory that renders a card with the message "This section is implemented in a later task." These placeholders allow the tabbed layout to render without import errors and will be replaced by tasks 04.02.03, 04.02.05, and 04.02.06 respectively.

---

## Expected Output

- GET /api/staff returns a paginated or full list of staff for the authenticated tenant
- POST /api/staff creates a new staff member and returns the created record
- PATCH /api/staff/[id] updates a staff member's profile and respects role-based access
- The staff list page at /dashboard/[tenantSlug]/staff renders a table with role badges and active/inactive toggles
- The Create Staff modal opens and submits correctly
- The staff detail page at /dashboard/[tenantSlug]/staff/[staffId] renders the breadcrumb, heading, role badge, and four tabs
- The Profile tab displays all fields and the edit form functions correctly

---

## Validation

- Navigate to /dashboard/[tenantSlug]/staff while authenticated as OWNER — confirm the page loads and the staff table renders
- Toggle a staff member's isActive status and confirm the UI updates optimistically and the database reflects the change
- Click "New Staff Member", fill the form, submit, and confirm the new entry appears in the table
- Navigate to a staff detail page and confirm all four tabs render without errors
- Confirm the Profile tab shows "Not clocked in" for a user with a null clockedInAt value
- Log in as a CASHIER and attempt to navigate to /dashboard/[tenantSlug]/staff — confirm the RBAC guard redirects appropriately

---

## Notes

- CommissionRate should be displayed using the formatPercent utility from Phase 01 if it exists, or created as a simple helper that formats a Decimal as "X.XX%".
- The Staff detail page uses a nested dynamic route ([tenantSlug]/staff/[staffId]) — ensure Next.js 15 App Router parallel or intercepting route patterns are not accidentally triggered. Keep the layout simple and flat.
