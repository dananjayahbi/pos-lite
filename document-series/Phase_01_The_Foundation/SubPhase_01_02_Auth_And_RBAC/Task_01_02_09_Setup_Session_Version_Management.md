# Task 01.02.09 — Setup Session Version Management

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_05 (Middleware scaffolded; session version check placeholder already present)

---

## Objective

Fully implement the session version invalidation mechanism — embedding sessionVersion in the JWT at sign-in, checking it against the database on every protected request in middleware, and exposing a Force Logout API endpoint that increments the version — so that administrators can immediately invalidate any user's active sessions.

---

## Instructions

### Step 1: Confirm the sessionVersion Field

Verify in prisma/schema.prisma that the User model includes the sessionVersion field as an Int with a default of 1 (added in Task 01.02.01). Run pnpm prisma validate to confirm the schema is valid. If the field is missing, add it now and run pnpm prisma migrate dev --name "add_session_version_to_user" followed by pnpm prisma generate to regenerate the client.

### Step 2: Embed sessionVersion in the JWT

Open src/lib/auth.ts and review the jwt callback. Confirm that on initial sign-in (when the user object is passed to the callback), the sessionVersion value from the user object is stored in the token under a field named sessionVersion. This was initially scaffolded in Task 01.02.02, but confirm it is correctly present and that the value is a number (not undefined). In the session callback, confirm that token.sessionVersion is copied into session.user.sessionVersion.

If the sessionVersion is not already being embedded, add it now: in the jwt callback, when user is present, assign token.sessionVersion equal to user.sessionVersion. Add the corresponding copy in the session callback.

### Step 3: Implement the Version Check in Middleware

Open src/middleware.ts. Locate the placeholder comment added during Task 01.02.05 for the session version check. Replace the placeholder with the full implementation.

The implementation should: extract the userId from the session (session.user.id) and the sessionVersion from the session (session.user.sessionVersion, typed as a number). Perform a Prisma query using findUnique with the userId as the primary key filter, selecting only the sessionVersion field. Compare the result's sessionVersion against the token's sessionVersion: if the database value is strictly greater than the token's value, the session is stale. In that case, create a NextResponse redirect to /login with the query parameter sessionExpired=true, and set a response cookie that clears the Auth.js session cookie (to ensure the client's cookie is wiped). Return this redirect response.

If the database version matches the token version, allow the request to proceed to the next middleware responsibility or to the route handler.

To minimize the performance overhead of this check on every request, implement a short-lived in-process cache using a JavaScript Map stored in module scope. The cache key is the userId and the cached value is an object containing the fetched sessionVersion and the timestamp when it was fetched. Before querying the database, check the cache: if the cache entry exists and is younger than 5 seconds, use the cached value. This reduces redundant queries for users generating rapid sequential requests (for example, the POS terminal polling for stock levels or loading a report). Set the cache TTL conservatively — 5 seconds is a good balance between freshness and query volume.

### Step 4: Create the Force Logout API Endpoint

Create the directory src/app/api/admin/users/[userId]/force-logout/ and inside it create route.ts as a Next.js Route Handler. The file exports an async POST function.

The POST handler first retrieves the current session using the auth() function from src/lib/auth.ts. If no session is present, return a 401 response. Check the session user's role: if it is neither SUPER_ADMIN nor OWNER, return a 403 response. This endpoint is accessible only to these two privileged roles.

For OWNER role callers, add an additional check: query the target User's tenantId and compare it against the session user's tenantId. An OWNER may only force-logout users within their own tenant. If the tenantIds do not match, return a 403 response.

Extract the userId from the URL path parameters (Next.js provides these via the params argument to the route handler). Validate that userId is a non-empty string. Query the database for the target User to confirm they exist. If not found, return a 404 response.

Perform the Prisma update to increment the User's sessionVersion by 1 using the increment operator. Return a 200 JSON response with the message "User sessions have been invalidated." Also write an AuditLog entry via the audit service recording a FORCE_LOGOUT_TRIGGERED action with the actorId set to the calling user's id and the entityId set to the target userId.

Add the corresponding cache invalidation: if the in-process cache from Step 3 contains an entry for the target userId, delete it so the middleware performs a fresh database check on the next request from that user rather than serving a stale cached version.

### Step 5: Display the Session Expired Banner on the Login Page

Open src/app/(auth)/login/page.tsx. Confirm that the page already reads the sessionExpired search parameter (added in Task 01.02.03). If it was not added in that task, add it now: use the useSearchParams hook to read the sessionExpired query parameter. If the parameter equals "true", render an informational banner above the login card with a sand background (--color-sand), espresso text, and the message "Your session has expired or an administrator has signed you out. Please sign in again." The banner should be dismissible (an X button or it fades out after reading).

### Step 6: Test the Force Logout Flow End to End

Perform the following end-to-end test to confirm the mechanism works correctly:

Log in as an OWNER in browser tab A. Note the dashboards loads correctly. In browser tab B (or a separate private window), log in as a SUPER_ADMIN. Navigate to the admin area for the OWNER's user account. Call the Force Logout endpoint for the OWNER's userId (simulate via a direct API call using a REST client or by triggering it from a superadmin page if available). Return to tab A and make any navigation action. Confirm the tab redirects to /login?sessionExpired=true with the correct banner displayed.

---

## Expected Output

- sessionVersion is embedded in the JWT token at sign-in and copied into session.user
- Middleware performs a version check on every protected request with a 5-second in-process cache
- A stale session redirects to /login?sessionExpired=true with the session cookie cleared
- The Force Logout endpoint at POST /api/admin/users/[userId]/force-logout increments sessionVersion
- The endpoint is accessible to SUPER_ADMIN (all users) and OWNER (own-tenant users only)
- The login page banner displays correctly when sessionExpired=true is in the query

---

## Validation

- [ ] session.user.sessionVersion is populated correctly after sign-in
- [ ] The JWT callback stores sessionVersion in the token on initial sign-in
- [ ] The middleware version check queries the database and uses the in-process cache
- [ ] Incrementing a user's sessionVersion in the database causes their next request to be redirected
- [ ] The redirect goes to /login?sessionExpired=true with the session cookie wiped
- [ ] POST /api/admin/users/[userId]/force-logout returns 403 for MANAGER and CASHIER callers
- [ ] POST /api/admin/users/[userId]/force-logout returns 403 for an OWNER targeting a different tenant's user
- [ ] POST /api/admin/users/[userId]/force-logout returns 200 and increments sessionVersion for valid callers
- [ ] An AuditLog record with action FORCE_LOGOUT_TRIGGERED is created after a successful force logout
- [ ] The login page displays the "session expired" banner when sessionExpired=true is in the URL
- [ ] pnpm tsc --noEmit passes without errors in all modified files

---

## Notes

- The in-process cache is a module-level Map and therefore shared across all requests handled by the same Node.js process instance. On serverless deployments (Vercel), each function instance has its own isolated memory, so the cache does not persist across cold starts. This is fine — it is an optimisation for warm instances only.
- The cache TTL of 5 seconds means that after a Force Logout, the affected user's next request could still be served a cached "version OK" result for up to 5 seconds before the redirect fires. This 5-second window is considered acceptable. If stricter invalidation is required, reduce the TTL to 0 (disabling the cache) at the cost of a database query on every request.
- Never use localStorage or sessionStorage for session version storage on the client side. The source of truth is always the database value, checked in middleware.
- The increment operation in Prisma uses the atomic increment syntax on the update call, not a manual read-then-write. This prevents race conditions if two concurrent Force Logout requests are made for the same user.
- The Force Logout endpoint should also be called internally by the password reset flow (Task 01.02.07 already handles this by incrementing sessionVersion directly in the reset handler). These are two separate code paths achieving the same outcome via the same mechanism.
