# Task 01.03.09 — Implement Tenant Status Middleware

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** High
- **Dependencies:** Task_01_03_01 (Tenant model exists), Task_01_03_07 (getActiveTenantBySlug function created)

## Objective

Extend src/middleware.ts to enforce tenant access status on every request to store-facing routes, redirecting suspended tenants to the suspension overlay page and injecting the grace period header for tenants in grace period, using a two-part architecture that routes around the Edge Runtime's Prisma incompatibility.

## Instructions

### Step 1: Understand the Existing Middleware Structure

Open src/middleware.ts. This file was created during SubPhase 01.02.05 and already handles authentication enforcement — redirecting unauthenticated users to /login for protected routes. The tenant status logic is appended to this same file. The middleware matcher pattern must be reviewed to ensure tenant status checks only run for (store) routes, not Super Admin routes or public pages.

### Step 2: Create the Internal Tenant Status API Endpoint

Because Next.js Middleware runs on the Edge Runtime and the standard Prisma client requires the Node.js runtime, tenant status must be resolved via a fetch call to a dedicated internal Route Handler. Create the file src/app/api/internal/tenant-status/route.ts. This is a GET Route Handler that accepts a tenantId query parameter. Inside the handler, import the Prisma client and query the Tenant model using findUnique matching on the provided tenantId, selecting only the id and status fields. If the tenant is not found or is soft-deleted (deletedAt is not null), return a 404 JSON response with a message of "Tenant not found". Otherwise return a 200 JSON response with the id and status values. This endpoint does not require authentication because it is considered an internal service endpoint — its data is non-sensitive (status only, no PII), and only tenant IDs obtained from a verified session are ever passed to it.

### Step 3: Define the Store Route Path Matcher

In middleware.ts, define the URL patterns that require tenant status enforcement. Using the Next.js middleware config export, ensure the matcher includes all paths under the store route group — these are paths that do not start with /superadmin, /api, /_next, /login, /suspended, or the public marketing pages. The general pattern should cover all authenticated store pages without matching the authentication flow, the Super Admin portal, or static assets.

### Step 4: Resolve the Tenant Identifier From the Request

Within the middleware function, after confirming the request matches the store route pattern, determine the current tenant's identifier. There are two sources to check. First, attempt to extract the subdomain from the request's hostname: if the hostname matches the pattern [slug].velvetpos.com, extract the slug portion. Second, if no subdomain is found (which occurs in development when running on localhost), fall back to reading the tenantId value from the user's NextAuth session token — the session JWT must contain the tenantId field, which was added to the session callback in SubPhase 01.02.02. If neither source yields a tenant identifier, redirect the request to a generic error page and do not proceed.

### Step 5: Fetch the Tenant Status Via the Internal Endpoint

Using the native fetch function available in the Edge Runtime, make a GET request to the internal endpoint at the application's own base URL followed by /api/internal/tenant-status with the tenantId or slug as a query parameter. The base URL is constructed from the NEXTAUTH_URL environment variable or from the request's origin. Set a fetch timeout and configure the next option with a short revalidation window — no-store to ensure the status is always fresh for security-critical enforcement. Await the response and parse the JSON body. If the fetch itself throws or returns a non-2xx status, treat it as "tenant unknown" and apply the error redirect.

### Step 6: Enforce SUSPENDED Status

If the tenant status value returned by the internal endpoint equals "SUSPENDED", use the NextResponse.redirect method to redirect the user to the /suspended route. Construct the redirect URL using the same origin as the original request. This redirect must happen before any other response processing so that suspended tenants cannot access any store content under any circumstances.

### Step 7: Enforce GRACE_PERIOD Status

If the tenant status equals "GRACE_PERIOD", allow the request to continue to its destination but modify the response to include the custom header x-grace-period with the value "true". Use NextResponse.next() and call the response object's headers.set method on the resulting response before returning it. The store layout will read this header server-side to decide whether to render the GracePeriodBanner component.

### Step 8: Pass Through ACTIVE and All Other Statuses

If the tenant status is "ACTIVE" or any other value not explicitly handled (such as "TRIALING"), return NextResponse.next() without modification. The CANCELLED status is a special case — if a tenant is CANCELLED, treat it as SUSPENDED and apply the suspension redirect, since a cancelled tenant's store should be inaccessible to its users.

### Step 9: Update the Middleware Config Matcher

Ensure the exported config object's matcher array includes the store route paths and excludes: all /api/ routes, all /_next/ static and image paths, the /login and /suspended pages, and any favicon or asset files. The tenant status check should run only for authenticated page requests within the store route group.

## Expected Output

- src/middleware.ts includes tenant status enforcement after the existing auth checks
- src/app/api/internal/tenant-status/route.ts is a lightweight GET Route Handler returning tenant id and status
- A request from a SUSPENDED tenant's session is redirected to /suspended before reaching any store page
- A request from a GRACE_PERIOD tenant receives the x-grace-period: true header and continues to its destination
- A request from an ACTIVE tenant proceeds normally with no modification

## Validation

- [ ] src/app/api/internal/tenant-status/route.ts exists and returns the correct id and status for a valid tenantId
- [ ] GET /api/internal/tenant-status?tenantId=[unknown] returns a 404 response
- [ ] Visiting a store route while the tenant status is SUSPENDED redirects to /suspended
- [ ] Visiting a store route while the tenant status is GRACE_PERIOD adds x-grace-period: true to the response headers
- [ ] Visiting a store route while the tenant status is ACTIVE proceeds normally with no redirect
- [ ] The middleware does not interfere with /api/*, /_next/*, or /login routes
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

The internal tenant-status endpoint is exposed without authentication by design because it returns no sensitive personal data — only a UUID and an enum value. However, if the platform scales to a point where brute-force ID enumeration becomes a concern, a shared internal secret header (passed only from the middleware) can be added as a low-cost security layer. Document this as a Phase 5 hardening task. The fetch result should never be cached for longer than the request lifecycle to ensure status changes (such as a manual suspension by the Super Admin) take effect on the very next request from the affected tenant's users.
