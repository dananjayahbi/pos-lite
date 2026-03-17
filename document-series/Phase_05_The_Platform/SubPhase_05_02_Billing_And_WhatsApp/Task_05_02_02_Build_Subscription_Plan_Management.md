# Task 05.02.02 — Build Subscription Plan Management (Super Admin)

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.02 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Medium |
| Depends On | 05.02.01 |
| Primary Files | src/app/dashboard/super-admin/plans/page.tsx, src/components/super-admin/PlanFormDialog.tsx, src/app/api/admin/plans/route.ts, src/app/api/admin/plans/[id]/route.ts |
| Roles Involved | SUPER_ADMIN |

## Objective

Build the Super Admin subscription plan management interface at /dashboard/super-admin/plans. Super Admins can view all SubscriptionPlan records, create new plans, edit existing plan details, and toggle the active state of any plan. Plans serve as the source of truth for tier entitlements across all tenants.

## Instructions

### Step 1: Create the Plans List API Route

Create src/app/api/admin/plans/route.ts. This file handles two HTTP methods.

The GET handler authenticates the request using the NextAuth session. If the session is absent or the user's role is not SUPER_ADMIN, return a 403 JSON response with message "Forbidden". Otherwise, query all SubscriptionPlan records ordered by monthlyPrice ascending, including a count of Subscription records referencing each plan (using Prisma's _count relation include). Return the array as JSON with status 200.

The POST handler also requires SUPER_ADMIN. It reads and parses the JSON request body. Apply a Zod validation schema that enforces: name must be one of the literals "STARTER", "GROWTH", or "ENTERPRISE"; monthlyPrice and annualPrice must be positive numbers; maxUsers and maxProductVariants must be positive integers greater than zero; features must be a non-empty array of non-empty strings. If validation fails, return a 422 response with the Zod formatted errors. On success, create the SubscriptionPlan and return a 201 response with the created record.

### Step 2: Create the Plan Edit API Route

Create src/app/api/admin/plans/[id]/route.ts. The PATCH handler accepts a partial update body with all plan fields optional, plus an isActive Boolean. Extract the id from the route params. Query the plan by id — if not found, return a 404 JSON response. Validate the partial body with a Zod schema using .partial() on the plan schema from Step 1. Apply the validated update using prisma.subscriptionPlan.update and return the updated record with status 200.

There is no DELETE handler on this route. Plans are toggled via the isActive field only, never deleted, to preserve the historical integrity of Subscription records that reference the plan.

### Step 3: Build the Plans List Page

Create src/app/dashboard/super-admin/plans/page.tsx as a Next.js server component. At the top of the component, fetch all plans by calling the plans API route or by calling the Prisma client directly (inside the server component, direct Prisma calls are preferred over fetch round-trips for same-origin server-side data). Validate the session and redirect to /auth/login if the role is not SUPER_ADMIN.

Render the page with the following layout: a page heading "Subscription Plans" in Playfair Display font with espresso (#3A2D28) color, a subheading "Manage the pricing tiers available to VelvetPOS tenants" in Inter with mist (#D1C7BD) color, an "Add Plan" button aligned to the right of the heading row, and a ShadCN Table below.

The table uses ShadCN's Table, TableHeader, TableHead, TableBody, TableRow, and TableCell components. Define the following columns: Plan Name, Monthly Price (LKR), Annual Price (LKR), Max Users, Max Variants, Active Subscribers, Status, and Actions. Each row corresponds to one SubscriptionPlan. The Status cell renders a ShadCN Badge — use the "default" variant with a green class override for isActive true and the "secondary" variant for isActive false. The Actions cell contains an "Edit" icon button that triggers the plan edit dialog populated with that row's data.

### Step 4: Build the Plan Form Dialog Component

Create src/components/super-admin/PlanFormDialog.tsx as a client component marked with "use client". This component receives an optional existingPlan prop (partial SubscriptionPlan) and an onSuccess callback.

The component renders a ShadCN Dialog containing a form managed by React Hook Form with resolver set to Zod. The form fields are:
- Plan Name: a ShadCN Select with options STARTER, GROWTH, ENTERPRISE. Disabled when editing an existing plan (plan name changes are not allowed).
- Monthly Price (LKR): a numeric Input component.
- Annual Price (LKR): a numeric Input component.
- Max Users: a numeric Input.
- Max Product Variants: a numeric Input.
- Features: a dynamic list where the user can add and remove string entries; use a ShadCN Input with an "Add" button and render each existing feature as a removable Badge with an ×  button.
- Status (Active): a ShadCN Switch component, shown only in edit mode.

On form submit, call POST /api/admin/plans for new plans or PATCH /api/admin/plans/[id] for existing ones using the TanStack Query useMutation hook. On success, call the onSuccess callback (which invalidates the plans query in the parent), close the dialog, and display a success toast notification. On error, display an error toast with the returned message.

The "Add Plan" button on the plans page opens this dialog with no existingPlan prop. The "Edit" button in each table row opens it with the row's plan data pre-populated.

### Step 5: Add Navigation Entry

In the Super Admin sidebar navigation component (established in SubPhase 05.01), add a "Plans" navigation link pointing to /dashboard/super-admin/plans, positioned between the "Tenants" and "Metrics" links. Use the CreditCard or LayoutGrid icon from Lucide React to represent the plans section.

## Expected Output

- GET /api/admin/plans — returns all plans with active subscriber count
- POST /api/admin/plans — creates a new plan, SUPER_ADMIN only, with Zod validation
- PATCH /api/admin/plans/[id] — partial update including isActive toggle
- /dashboard/super-admin/plans — paginated plan table with edit dialogs and add button
- PlanFormDialog component with dynamic feature flag list management

## Validation

- [ ] Unauthenticated GET /api/admin/plans returns 401 or 403
- [ ] OWNER or MANAGER role accessing the plans API returns 403
- [ ] POST with name "PREMIUM" (not in enum) returns 422 with a Zod validation error
- [ ] POST with negative monthlyPrice returns 422
- [ ] Edit dialog pre-populates all fields from the existing plan record
- [ ] Plan Name Select is disabled in edit mode
- [ ] Toggling isActive to false via PATCH reflects immediately in the Status badge
- [ ] Active subscriber count in the table matches the actual count of Subscription records per plan
- [ ] Deactivating a plan does not change the status of existing subscriptions on that plan

## Notes

- Plan changes are not retroactive. A tenant subscribed to GROWTH at 3,500 LKR/month will continue at that price even if the plan's monthlyPrice is edited — this is the intended behavior and the plan record serves as the initial billing template, not a live modifier.
- The features array should follow a consistent namespace convention used by the tenant entitlement checking function: format strings as "module:permission" (e.g., "pos:returns", "reports:advanced", "staff:unlimited"). Document the full feature flag registry in SubPhase 05.01's technical context doc.
- A plan cannot be deleted via the API even by SUPER_ADMIN, to preserve historical billing records. The isActive flag governs new signup availability only.
