# Task 05.02.07 — Build Suspension Middleware and Notice Page

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.07 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Medium |
| Depends On | 05.02.06 |
| Primary Files | src/middleware.ts, src/app/dashboard/[tenantSlug]/suspended/page.tsx |
| Roles Involved | All (enforced transparently in middleware) |

## Objective

Extend the Next.js middleware to check the tenant's subscriptionStatus on every request. If a tenant is SUSPENDED or CANCELLED, redirect all dashboard and POS routes (except the billing page) to a branded suspension notice page. Super Admin users and TRIAL users bypass this check entirely.

## Instructions

### Step 1: Locate the Existing Middleware Logic

Open src/middleware.ts. This file was established in SubPhase 01.02 and already handles session authentication and tenant resolution from the subdomain. Identify the point in the middleware pipeline where the tenant object or session is fully resolved — this is where the subscription status check will be inserted. The middleware must keep its existing authentication guard intact before the new billing check executes.

### Step 2: Read subscriptionStatus from the Session Token

In SubPhase 01.02, the NextAuth JWT strategy encodes session fields. Extend the JWT token to include the subscriptionStatus field drawn from the Tenant record at sign-in. Update the NextAuth session callback (in src/lib/auth/[...nextauth]/route.ts or the NextAuth config in src/lib/auth.ts) to populate token.subscriptionStatus = tenant.subscriptionStatus when the session is created or refreshed.

In the middleware, read subscriptionStatus from the decoded JWT token: const status = token?.subscriptionStatus as string | undefined. If the status field is absent (legacy sessions), treat the tenant as active to avoid locking out users during a migration window.

### Step 3: Define the Bypass Path List

Directly above the suspension check block in the middleware, define a bypass predicate. A request bypasses the suspension check if any of the following conditions are true:
- The request pathname starts with /api/ (all API routes, including webhooks and billing)
- The request pathname starts with /auth/ (authentication pages)
- The request pathname contains /billing (the billing page for any tenantSlug)
- The request pathname contains /suspended (the notice page itself — avoid redirect loops)
- The request pathname starts with /dashboard/super-admin/ (Super Admin routes are never tenant-scoped)
- The request pathname starts with /_next/ (Next.js internals)
- The request pathname starts with /favicon or /manifest (static assets)

Use request.nextUrl.pathname for the check. Construct this as a helper function isSuspensionBypassPath(pathname: string): boolean within the middleware file.

### Step 4: Add the Suspension Redirect Logic

After confirming the bypass list does not apply, check whether the session user's role is SUPER_ADMIN. If so, skip the suspension check entirely using an early return that calls next() on the middleware chain.

If the role is not SUPER_ADMIN and the subscriptionStatus is "SUSPENDED" or "CANCELLED", redirect the request. Extract the tenantSlug from the request subdomain or from an existing session field. Construct the redirect URL as: /dashboard/[tenantSlug]/suspended. For CANCELLED status, append the query parameter ?reason=cancelled to the redirect URL. Execute the redirect using NextResponse.redirect(new URL(redirectPath, request.url)).

If the subscriptionStatus is "TRIAL" or "PAST_DUE", do not redirect — these statuses allow full access with the informational banners rendered by the dashboard layout (Task 05.02.03).

### Step 5: Build the Suspension Notice Page

Create src/app/dashboard/[tenantSlug]/suspended/page.tsx as a server component. This page must be accessible even to suspended tenants (middleware bypass ensures this).

At the top of the server component, resolve the tenantSlug from the params prop. Fetch the Tenant record including its latest Invoice where status is PENDING or FAILED and order by createdAt descending. Read the reason query parameter from searchParams to distinguish between SUSPENDED and CANCELLED renders.

Render the page with a full-height linen (#EBE3DB) background and a centred content card with espresso (#3A2D28) borders. Include the following elements in order:
- VelvetPOS wordmark or logo at the top of the card
- A large heading in Playfair Display: "Subscription Suspended" (or "Subscription Cancelled" if reason=cancelled)
- A paragraph in Inter: "Your VelvetPOS subscription for [tenantName] has been suspended due to an overdue payment. Please renew to restore full access." (Adjusted copy for the CANCELLED reason variant: "Your subscription has been cancelled. Contact your account owner to reactivate.")
- If an outstanding invoice exists: a row showing "Amount Due: LKR [amount]" in JetBrains Mono with terracotta (#A48374) text
- A "Renew Subscription" button with terracotta background and white text, linking to /dashboard/[tenantSlug]/billing. Style using a ShadCN Button with className overrides for the brand colour.
- A support contact line in mist (#D1C7BD) text: "Need help? Contact us at support@velvetpos.com"

The page is intentionally sparse and action-focused. It must render correctly on mobile screens (375px wide) as many boutique owners check their devices from their shop floor.

### Step 6: Handle Route Matching for Dynamic Tenant Slugs

The tenantSlug in VelvetPOS may appear either as a subdomain (e.g., pehesara.velvetpos.com) or as a path segment (e.g., velvetpos.com/dashboard/pehesara/billing) depending on the deployment mode. Ensure the middleware correctly extracts the slug for constructing the redirect URL in both modes. If the current deployment uses subdomain routing established in SubPhase 05.01, use the host header to extract the subdomain. If path-based routing is used, extract the first dynamic segment from the pathname. Refer to the routing strategy documented in SubPhase 05.01.

### Step 7: Test All Status Transitions

Manually or via integration tests, verify the redirect behaviour for each subscriptionStatus value. Create a simple test matrix: for each of TRIAL, ACTIVE, PAST_DUE, SUSPENDED, and CANCELLED statuses, and for each of an OWNER, MANAGER, CASHIER, and SUPER_ADMIN role, verify that the request resolves to the expected destination. Document this matrix in a comment block at the top of the middleware file.

## Expected Output

- src/middleware.ts with subscription status check block
- SUSPENDED and CANCELLED tenants redirected for all dashboard and POS routes
- Billing, auth, API, and Super Admin routes remain accessible for all statuses
- Branded suspension notice page at /dashboard/[tenantSlug]/suspended
- CANCELLED reason variant showing adjusted copy

## Validation

- [ ] SUSPENDED tenant requesting /dashboard/[tenantSlug]/pos receives a redirect to /suspended
- [ ] SUSPENDED tenant requesting /dashboard/[tenantSlug]/billing receives no redirect
- [ ] SUSPENDED tenant requesting /api/billing/cancel receives no redirect (API bypass)
- [ ] SUPER_ADMIN user is never redirected regardless of any tenant's subscriptionStatus
- [ ] TRIAL tenant is never redirected by the subscription check
- [ ] ACTIVE tenant is never redirected by the subscription check
- [ ] Suspension notice page displays the outstanding invoice amount formatted in JetBrains Mono
- [ ] CANCELLED reason query parameter produces the "cancelled" copy variant on the notice page
- [ ] "Renew Subscription" button links correctly to /dashboard/[tenantSlug]/billing
- [ ] The page renders without errors when no invoice record exists for the tenant

## Notes

- The subscriptionStatus check in middleware runs on every matched request. Reading it from the JWT token payload is far preferable to a database query per request. Ensure subscriptionStatus is always included as a claim in the JWT and is refreshed whenever the subscription status changes (trigger a token rotation or invalidation after each IPN-driven status change).
- Test the bypass path predicate with both trailing-slash and non-trailing-slash variants of the billing URL. Next.js may normalise paths differently depending on the router configuration.
- The suspension page deliberately does not show the full dashboard navigation. This is intentional: a suspended tenant should see only the renewal CTA and support information, not a confusing partially-functional interface.
