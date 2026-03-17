# Task 01.02.10 — Build Login Audit Trail

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Low
- **Dependencies:** Task_01_02_02 (NextAuth configured; AuditLog model exists from Task 01.02.01)

---

## Objective

Create the audit service module with a createAuditLog function, define all loggable authentication event constants, and wire the service into every authentication code path so that every login attempt, logout, password event, and session invalidation is recorded with full context in the AuditLog table.

---

## Instructions

### Step 1: Create the Audit Service File

Create the file src/lib/services/audit.service.ts. This module is a pure server-side service that writes to the AuditLog table via the shared Prisma client instance. It must never be imported into Client Components.

### Step 2: Define the AUTH_ACTIONS Constant

At the top of the audit service file, export a constant object named AUTH_ACTIONS. This object enumerates all authentication-related events that VelvetPOS wishes to log. Each key is a descriptive identifier in SCREAMING_SNAKE_CASE and each value is the same string (matching the key), which is what gets stored in the AuditLog.action column. Define the following entries:

- LOGIN_SUCCESS: successful email and password authentication
- LOGIN_FAILED_INVALID_CREDENTIALS: email and password combination did not match
- LOGIN_FAILED_ACCOUNT_INACTIVE: user was found but isActive is false
- LOGIN_FAILED_ACCOUNT_SUSPENDED: future use — tenant is suspended (reserved for use with the tenant status check)
- PIN_LOGIN_SUCCESS: successful PIN authentication
- PIN_LOGIN_FAILED: PIN comparison failed or user not found during PIN login
- LOGOUT: user explicitly signed out
- PASSWORD_RESET_REQUESTED: forgot-password form was submitted and a token was issued for a real account
- PASSWORD_RESET_COMPLETED: reset-password form was successfully submitted and password was updated
- SESSION_INVALIDATED_BY_VERSION_MISMATCH: middleware detected a stale sessionVersion and redirected to login
- FORCE_LOGOUT_TRIGGERED: an admin explicitly called the force-logout endpoint for a user

Export the union type of all AUTH_ACTIONS values as AuthAction for type safety when calling the audit service.

### Step 3: Create the createAuditLog Function

Export an async function named createAuditLog from audit.service.ts. The function accepts a single parameter object with the following fields:

- tenantId: string or null — the tenant context; null for super admin events
- actorId: string or null — the user who performed the action; null when the actor could not be identified (failed login where the email does not match any user)
- actorRole: string — the role of the actor at the time of the event; use the string "UNKNOWN" when actorId is null
- entityType: string — describes the type of entity being acted upon (for auth events this is typically "User")
- entityId: string — the UUID of the entity; for failed login attempts where no user is found, use a placeholder string or hash of the submitted email
- action: string — one of the AUTH_ACTIONS values
- before: unknown object or undefined — optional snapshot of state before the action (rarely used for auth events)
- after: unknown object or undefined — optional snapshot of state after the action (rarely used for auth events)
- ipAddress: string or undefined
- userAgent: string or undefined

Inside the function, call prisma.auditLog.create with the provided data. Wrap the database call in a try-catch block. If the audit write fails, log the error to the server console but do not throw — audit log failures must never cause authentication requests to fail. Audit logging is a non-blocking side effect.

### Step 4: Add an IP Address Extraction Utility

Create a small helper function (either in audit.service.ts or in a shared utils file at src/lib/utils/request.ts) named getClientIp. The function accepts a Request object (the Web API Request available in Route Handlers and Auth.js callbacks) or a NextRequest and extracts the client IP address. Check the following headers in order, returning the first non-empty value: x-forwarded-for (take the first IP in the comma-separated list if multiple are present), x-real-ip, and cf-connecting-ip (for deployments behind Cloudflare). If none of those headers are present, return the string "unknown".

### Step 5: Wire Audit Logging into the Credentials Provider

Open src/lib/auth.ts and review the Credentials provider's authorize function. After each terminal outcome (success or failure), call createAuditLog. The Auth.js authorize function receives a request parameter that contains the incoming HTTP request; use this to extract the IP address and user agent.

For a successful login: call createAuditLog with the resolved user's tenantId, actorId set to the user's id, actorRole set to the user's role, entityType "User", entityId the user's id, action AUTH_ACTIONS.LOGIN_SUCCESS, and the extracted ipAddress and userAgent.

For the credential mismatch case (password comparison fails): call createAuditLog with actorId set to the found user's id (the email existed, the password was wrong), actorRole set to the user's role, action AUTH_ACTIONS.LOGIN_FAILED_INVALID_CREDENTIALS.

For the user-not-found case (no user with that email): call createAuditLog with actorId null, actorRole "UNKNOWN", entityType "User", entityId set to a hash of the submitted email (not the plain email — use a short SHA-256 prefix or a fixed placeholder string to avoid storing unverified email addresses in the audit log), action AUTH_ACTIONS.LOGIN_FAILED_INVALID_CREDENTIALS.

For the account inactive case: call createAuditLog with the user's id and role, action AUTH_ACTIONS.LOGIN_FAILED_ACCOUNT_INACTIVE.

Because the authorize function in Auth.js v5 can only receive the request via the second parameter, ensure the authorize function is declared with both credentials and request arguments. Destructure req from the second argument to access the request headers.

### Step 6: Wire Audit Logging into PIN Login

Open src/app/api/auth/pin/route.ts. After a successful PIN comparison, add a call to createAuditLog with action PIN_LOGIN_SUCCESS. After a failed PIN comparison (wrong PIN or user not found), add a call with action PIN_LOGIN_FAILED. In both cases, extract the IP address and user agent from the incoming request object.

### Step 7: Wire Audit Logging into the Force Logout Endpoint

Open src/app/api/admin/users/[userId]/force-logout/route.ts. After successfully incrementing the sessionVersion, call createAuditLog with action AUTH_ACTIONS.FORCE_LOGOUT_TRIGGERED. This was noted as a requirement in Task 01.02.09 and must be confirmed present here.

### Step 8: Wire Audit Logging into the Password Reset Flow

Open src/app/api/auth/forgot-password/route.ts. After successfully creating the VerificationToken and sending the reset email, call createAuditLog with action AUTH_ACTIONS.PASSWORD_RESET_REQUESTED, entityId set to the user's id. Note: only call this for real users — do not write an audit log entry for the requests that hit the consistent-response path for unknown emails, as doing so would allow an attacker to use timing differences in the audit write to infer email registration.

Open src/app/api/auth/reset-password/route.ts. After successfully updating the password hash and incrementing sessionVersion, call createAuditLog with action AUTH_ACTIONS.PASSWORD_RESET_COMPLETED.

---

## Expected Output

- src/lib/services/audit.service.ts exports AUTH_ACTIONS, AuthAction type, and createAuditLog function
- createAuditLog writes to the AuditLog table and silently swallows errors without interrupting the auth flow
- The getClientIp helper correctly extracts the real client IP from proxy headers
- Every successful login writes a LOGIN_SUCCESS AuditLog entry with IP address and user agent
- Every failed login attempt writes the appropriate failure action entry
- PIN login success and failure events are logged
- Force Logout events are logged
- Password reset request and completion events are logged

---

## Validation

- [ ] AUTH_ACTIONS constant contains all 11 defined event strings
- [ ] createAuditLog does not throw when called, even if the database write fails
- [ ] A successful login attempt creates an AuditLog record with action "LOGIN_SUCCESS"
- [ ] An incorrect password attempt creates an AuditLog record with action "LOGIN_FAILED_INVALID_CREDENTIALS"
- [ ] A login attempt with an unknown email creates an AuditLog record with actorId null and actorRole "UNKNOWN"
- [ ] A force logout creates an AuditLog record with action "FORCE_LOGOUT_TRIGGERED"
- [ ] AuditLog records include non-null ipAddress values when requests come from a known IP
- [ ] pnpm tsc --noEmit passes without errors in all modified files

---

## Notes

- The audit service is intentionally fire-and-forget for auth logging (errors are swallowed server-side). This is different from business-critical audit events (like sale voids or stock adjustments) that may need stricter error handling. Auth audit failures are recoverable — a missed log entry is less harmful than a blocked login.
- Do not log the submitted password or PIN in any field of the AuditLog record, including the before/after JSON fields. Storing credentials in audit logs creates a serious security vulnerability.
- The actorId is nullable in the AuditLog model specifically to support the case where a login attempt fails and no user can be identified. This is a common authentication log pattern and intentional by design.
- For the unknown-email failed login case, using a hash of the submitted email (rather than the email itself) in entityId ensures that unverified email addresses (which may belong to non-existent or private individuals) are not stored in the database. A truncated SHA-256 hash conveys the uniqueness without the PII.
- The Auth.js authorize function in v5 receives the raw Request object as its second parameter. This is the standard Web API Request with a headers property, from which you can read x-forwarded-for and user-agent using req.headers.get(...).
