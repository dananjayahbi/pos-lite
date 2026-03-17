# Task 01.02.05 — Build Middleware Auth Guard

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_02 (auth() from NextAuth.js available for import)

---

## Objective

Create src/middleware.ts implementing four distinct protective responsibilities: authentication guard, role-based route enforcement, session version staleness check, and tenant status check — with a precisely configured matcher that covers all protected routes while excluding static assets and public paths.

---

## Instructions

### Step 1: Understand the Middleware Execution Context

Next.js Middleware runs at the edge, meaning it executes before every matched request, before any React Server Component or Route Handler processes the request. This makes it the correct place to enforce authentication and redirect unauthenticated users. However, edge middleware runs in a limited runtime environment that does not support all Node.js APIs. Prisma Client cannot be instantiated directly in edge middleware because it relies on native binaries. For the session version check and tenant status check, which require database reads, use the Prisma HTTP extension (Accelerate) or restructure the check to use a lightweight fetch to an internal API route rather than a direct Prisma import. Document whichever approach is chosen clearly in the middleware file comments.

An alternative that avoids the edge constraint is to configure Next.js Middleware to run in the Node.js runtime instead of the edge runtime by exporting a runtime constant of "nodejs". This allows direct Prisma usage in middleware at the cost of slightly higher cold-start latency. Choose this approach for VelvetPOS to keep the architecture simple and avoid the Accelerate dependency.

### Step 2: Create src/middleware.ts

Create the file src/middleware.ts at the project root (the standard location for Next.js middleware). Import the auth function from src/lib/auth.ts. The middleware default export is a function that wraps the auth utility, following the Auth.js v5 pattern where the middleware is expressed as an auth callback.

### Step 3: Implement Authentication Guard

The first responsibility of the middleware is to check whether the request carries a valid session. For any route that is not in the public list (the (auth) group paths — /login, /pin-login, /forgot-password, /reset-password — and the /api/webhooks/ prefix), if the session is absent or invalid, redirect the request to /login with a callbackUrl query parameter set to the originally requested pathname. This ensures users are returned to their intended destination after authenticating.

Define the list of public paths as a constant array of string prefixes. Any incoming request pathname that starts with one of these prefixes bypasses all further checks and is allowed through.

### Step 4: Implement Role Enforcement

After confirming a session is present, check the session user's role. If the requested pathname starts with /superadmin and the user's role is not SUPER_ADMIN, redirect to /dashboard. This prevents non-super-admin users from accessing any part of the superadmin route group regardless of how they obtained a session. This check must happen for every request matching /superadmin/**, not just specific sub-routes.

Conversely, if a SUPER_ADMIN user attempts to access any route under the (store) group (for example /dashboard, /pos, /inventory), redirect them to /superadmin/dashboard instead. SUPER_ADMIN accounts are platform-level identities with no tenant context and should not be able to see tenant-specific data.

### Step 5: Implement Session Version Check

After passing the role enforcement check, retrieve the user's id and sessionVersion from the session JWT token. Perform a lightweight Prisma query to fetch only the sessionVersion field for that user ID. If the stored sessionVersion differs from (is greater than) the token's sessionVersion, the session is stale — it was issued before a Force Logout was triggered. In this case, redirect the user to /login with the query parameter sessionExpired=true appended. Before redirecting, call signOut to clear the session cookie.

Because this database call happens on every protected request in middleware, it must be as lightweight as possible: select only the id and sessionVersion columns and use a findUnique query with the primary key. Consider implementing a short-lived in-process cache (a Map with TTL of 5 seconds) keyed by userId to avoid redundant database calls on rapid sequential requests from the same user.

### Step 6: Implement Tenant Status Check

For all requests to routes within the (store) route group (all paths except /superadmin/** and (auth) paths), fetch the tenant's status from the database using the tenantId from the session. The Tenant model will be created in SubPhase 01.03. For now, add a placeholder comment in the middleware code where this check will be integrated, and implement a skip condition that continues to the next check if tenantId is null (Super Admin accounts have no tenant).

When the Tenant model is available, the check should: query the Tenant by tenantId selecting only the status field. If status is SUSPENDED, redirect to /suspended. If status is GRACE_PERIOD, allow the request to proceed but set a custom response header x-grace-period with the value "true" on the response so the (store) layout can read it and display a billing notice banner to the user.

### Step 7: Configure the Middleware Matcher

Export a config object from the middleware file with a matcher array. The matcher should use a single pattern that covers all paths except:

- Static files served from the /_next/static/ directory
- Image optimization paths under /_next/image/
- The /favicon.ico file
- Any path containing a file extension (to exclude .png, .jpg, .svg, .css, .js, and similar static assets)
- The /api/webhooks/ prefix (webhooks must not be blocked by auth)

A well-formed negative-lookahead matcher pattern achieves all of the above. The pattern should be expressed as a regex-compatible string that Next.js middleware config accepts. All other paths, including /api/auth/**, /api/** routes, and all page routes, go through the middleware.

Note that the /api/auth/** routes are handled by NextAuth internally but still pass through the middleware matcher. The middleware must explicitly allow /api/auth/** to pass without applying the authentication redirect, otherwise the login form submission itself would be blocked. Add /api/auth/ to the public paths list.

### Step 8: Test the Middleware Behavior

Start the development server and manually test the following scenarios to confirm correct middleware behavior:

Navigate to /dashboard without a session — confirm redirect to /login?callbackUrl=%2Fdashboard.

Log in as a CASHIER user and navigate to /superadmin/dashboard — confirm redirect to /dashboard.

Log in as a SUPER_ADMIN and navigate to /dashboard — confirm redirect to /superadmin/dashboard.

Manually increment a user's sessionVersion in the database and then make a request with the stale session — confirm redirect to /login?sessionExpired=true.

---

## Expected Output

- src/middleware.ts is present at the project root and exports a default middleware function and a config matcher
- Unauthenticated requests to any protected route are redirected to /login with the correct callbackUrl
- Non-SUPER_ADMIN sessions cannot access /superadmin/** routes
- SUPER_ADMIN sessions are redirected away from (store) routes
- A stale sessionVersion triggers a redirect to /login?sessionExpired=true
- The tenant status check placeholder is in place for integration in SubPhase 01.03
- Static assets, _next paths, and /api/webhooks/ are excluded from the matcher

---

## Validation

- [ ] Accessing /dashboard without a session redirects to /login?callbackUrl=%2Fdashboard
- [ ] Accessing /api/auth/session without a session returns valid JSON (not redirected to login)
- [ ] A MANAGER user accessing /superadmin/dashboard is redirected to /dashboard
- [ ] A SUPER_ADMIN user accessing /dashboard is redirected to /superadmin/dashboard
- [ ] A request with a stale sessionVersion is redirected to /login?sessionExpired=true
- [ ] Static assets (png, jpg, css, js files) are not intercepted by the middleware
- [ ] The /api/webhooks/ prefix is not blocked by the authentication guard
- [ ] pnpm tsc --noEmit passes without errors in middleware.ts
- [ ] The middleware config matcher is present and does not accidentally block public auth paths

---

## Notes

- Middleware that makes database calls on every request adds latency. Keep the Prisma query for session version check as minimal as possible — select a single integer field by primary key. PlanetScale-style connection pooling or Prisma Accelerate can further reduce cold-start time in production.
- The edge runtime limitation means that if you choose to export runtime as "nodejs", the middleware will run in the standard Node.js serverless context. This is perfectly acceptable for vercel deployments and avoids the complexity of Prisma Accelerate in early development.
- Never store sensitive information (like the full user object) in the request headers when passing data from middleware to page components. Use cookies set by Auth.js or read the session in the server component directly.
- The callbackUrl parameter should be URL-encoded. Next.js router handles this automatically when using NextResponse.redirect with a URL object, but verify the encoding if constructing the redirect URL as a string.
- The tenant status check is intentionally left as a placeholder in this task. Do not attempt to implement it against the Tenant model now, as that model does not exist yet. Return to this placeholder in SubPhase 01.03.
