# SubPhase 01.02 — Authentication, RBAC & Session Management

## Metadata

- **Phase:** 01 — The Foundation
- **Sub-Phase:** 01.02
- **Status:** Pending
- **Dependencies:** SubPhase 01.01 — Project Setup must be fully complete, including Prisma configured against PostgreSQL, the directory structure established, and all environment variables in place.

---

## Objective

This sub-phase constructs the complete identity and access control backbone of VelvetPOS. By the end of this sub-phase, every user type — from the platform-level Super Admin down to the store Cashier — will have a clearly defined authentication pathway, a scoped set of permissions, and a session lifecycle that is properly enforced by middleware and optionally locked after inactivity.

The work covers the full spectrum of auth concerns: credential-based login, 4-digit PIN quick entry for the POS terminal, role-based permission gates, automatic screen locking, password reset via email token, session version invalidation for forced logout, a comprehensive audit trail for every auth event, and rate limiting on sensitive endpoints. No part of the application should be reachable by an unauthenticated or insufficiently privileged user after this sub-phase is complete.

---

## Scope

### In Scope

- User and AuditLog Prisma models including all required fields and relations
- Session and VerificationToken models as required by the NextAuth.js Prisma adapter
- NextAuth.js v5 (Auth.js) Credentials provider configuration for email and password login
- Login page UI styled completely with the VelvetPOS espresso-and-linen design system
- PIN login page and the reusable PinEntryModal component for the 4-digit numpad flow
- Next.js Middleware auth guard covering authentication, role enforcement, session version check, and tenant status check
- RBAC permissions constants file defining all 50+ named permissions grouped by domain
- Default role-to-permissions mapping for OWNER, MANAGER, CASHIER, and STOCK_CLERK
- Client-side usePermissions hook for conditional UI rendering
- Server-side hasPermission utility for API route and server component guards
- Forgot password page, reset password page, and the token-based email flow
- Email service integration (Resend or SMTP) for sending the password reset link
- Auto-logout inactivity timer hook with configurable timeout (default 10 minutes)
- ScreenLockOverlay component covering all (store) layout pages, preserving cart state
- Session version invalidation: the sessionVersion field on User and middleware version check
- Force Logout API endpoint that increments sessionVersion for a given user
- Login and action audit trail writing AuditLog records for every auth event
- Rate limiting on /api/auth login and /api/auth/pin (10 attempts per IP per 15-minute sliding window)
- Super Admin seeder script in prisma/seed.ts creating the first SUPER_ADMIN account

### Out of Scope

- Store staff onboarding UI (inviting new staff to a tenant) — covered in Phase 01.03 Tenant Provisioning
- Staff profile management pages (viewing/editing one's own profile) — covered in Phase 4
- Commission schemes and attendance tracking — covered in Phase 4
- WhatsApp or SMS notifications for authentication events — covered in Phase 5
- OAuth or magic-link alternative login methods — not planned for VelvetPOS

---

## Technical Context

### Authentication Architecture

VelvetPOS uses NextAuth.js v5 (the Auth.js rewrite) with the Prisma adapter. The Credentials provider is the sole login method. On successful credential validation, the JWT strategy embeds the user's id, role, permissions array, tenantId, and sessionVersion directly into the JWT token. The session object exposed to client components mirrors these fields after passing through the session callback.

The application has two top-level route groups that the middleware must distinguish:

| Route Group | Path Prefix | Access |
|---|---|---|
| (auth) | /login, /pin-login, /forgot-password, /reset-password | Public — no session required |
| (store) | /dashboard, /pos, /inventory, /reports, etc. | Protected — requires valid session |
| (superadmin) | /superadmin/** | Protected — requires SUPER_ADMIN role |

### Role Hierarchy

| Role | Scope | Key Restrictions |
|---|---|---|
| SUPER_ADMIN | Platform-wide | Only accesses (superadmin) routes; no tenantId |
| OWNER | Store-wide | All (store) routes; manages billing and settings |
| MANAGER | Store operational | POS, inventory, reports, CRM; cannot access billing or subscription settings |
| CASHIER | POS only | POS terminal and basic customer lookup; cannot view cost prices |
| STOCK_CLERK | Inventory only | Inventory management and purchase order receiving only |

### Session Security Model

The JWT token carries a sessionVersion integer that is compared against the database value on every protected request in middleware. Incrementing the database value (Force Logout) immediately invalidates all issued tokens for that user at the next request boundary. This approach avoids the overhead of a token revocation store while still providing near-real-time session invalidation.

### Password Security

All passwords are hashed with bcrypt at a minimum cost factor of 12. PINs are also stored as bcrypt hashes — they are not stored in plain text. The forgot-password flow uses a 32-byte cryptographically random token with a 1-hour expiry, stored in the VerificationToken table. On password reset, the sessionVersion is incremented to invalidate existing sessions.

### Rate Limiting Strategy

An in-memory sliding window rate limiter is implemented in src/lib/rate-limit.ts. It is applied to both the Credentials provider authorize function (key prefix "login:{ip}") and the PIN login API route (key prefix "pin:{ip}"). The limit is 10 attempts per IP per 15-minute window. Exceeding this limit returns an HTTP 429-equivalent error before any database query is made, preventing enumeration and brute-force attacks.

### Audit Trail

Every authentication event writes a record to the AuditLog table. The audit service captures the actor, the action taken, the entity involved, timestamps, IP address, and user agent. Failed login attempts are logged with actorId null and actorRole "UNKNOWN" when the user cannot be identified. This provides a complete forensic timeline for compliance and security review.

---

## Task List

| Task ID | Task Name | Est. Complexity | Dependencies |
|---|---|---|---|
| Task_01_02_01 | Create User And AuditLog Models | Medium | SubPhase 01.01 complete |
| Task_01_02_02 | Configure NextAuth Credentials | Medium | Task_01_02_01 |
| Task_01_02_03 | Build Login Page | Medium | Task_01_02_02 |
| Task_01_02_04 | Implement PIN Login Flow | Medium | Task_01_02_02 |
| Task_01_02_05 | Build Middleware Auth Guard | Medium | Task_01_02_02 |
| Task_01_02_06 | Build RBAC Permission System | Medium | Task_01_02_01 |
| Task_01_02_07 | Build Forgot Password Flow | Medium | Task_01_02_02 |
| Task_01_02_08 | Implement Auto Logout Screen Lock | Medium | Task_01_02_04 |
| Task_01_02_09 | Setup Session Version Management | Medium | Task_01_02_05 |
| Task_01_02_10 | Build Login Audit Trail | Low | Task_01_02_02 |
| Task_01_02_11 | Implement Auth Rate Limiting | Medium | Task_01_02_02 |
| Task_01_02_12 | Seed Super Admin Account | Low | Task_01_02_01 |

---

## Validation Criteria

- [ ] pnpm tsc --noEmit passes with zero TypeScript errors after all tasks are complete
- [ ] Valid credentials log in successfully and redirect to the correct route for the user's role
- [ ] Invalid credentials show an inline error message without creating a session
- [ ] PIN login flow accepts a correct PIN and creates a valid session
- [ ] An incorrect PIN shows an error message and counts against the rate limit
- [ ] Unauthenticated requests to all (store) routes redirect to /login with a callbackUrl parameter
- [ ] CASHIER account attempting to access /superadmin routes is redirected to /dashboard
- [ ] SUPER_ADMIN account attempting to access (store) routes is redirected to /superadmin/dashboard
- [ ] usePermissions hook correctly returns true for a permission the user holds and false for one they do not
- [ ] hasPermission server utility returns the correct boolean for a given user object and permission string
- [ ] Forgot password form sends an email with a valid reset link when a known email is submitted
- [ ] Reset password with a valid, non-expired token successfully updates the password hash
- [ ] Reset password with an expired or unknown token returns an appropriate error
- [ ] The 11th login attempt within a 15-minute sliding window for the same IP returns a rate limit error
- [ ] AuditLog receives a new entry on every login attempt, both successful and failed
- [ ] After a Force Logout (sessionVersion increment), the next request for the affected user is redirected to /login
- [ ] Super Admin seeder creates the SUPER_ADMIN account idempotently and the account can log in
- [ ] ScreenLockOverlay appears after 10 minutes of inactivity and blocks all navigation
- [ ] Correct PIN on the lock screen clears the overlay and restores the POS cart state intact

---

## Files Created / Modified

- prisma/schema.prisma — Modified: User, Session, VerificationToken, and AuditLog models added
- prisma/migrations/ — New migration directory entry for "add_auth_models"
- prisma/seed.ts — Modified: Super Admin seeding logic added
- src/lib/auth.ts — Created: NextAuth.js v5 configuration with Credentials provider
- src/types/next-auth.d.ts — Created: TypeScript module augmentation for session and JWT types
- src/app/api/auth/[...nextauth]/route.ts — Created: NextAuth route handler
- src/app/api/auth/pin/route.ts — Created: PIN login API route
- src/app/api/auth/forgot-password/route.ts — Created: Forgot password API route
- src/app/api/auth/reset-password/route.ts — Created: Reset password API route
- src/app/api/admin/users/[userId]/force-logout/route.ts — Created: Force logout endpoint
- src/app/(auth)/login/page.tsx — Created: Email and password login page
- src/app/(auth)/pin-login/page.tsx — Created: Full-page PIN login
- src/app/(auth)/forgot-password/page.tsx — Created: Forgot password page
- src/app/(auth)/reset-password/page.tsx — Created: Reset password page
- src/middleware.ts — Created: Auth guard, role enforcement, session version check, tenant status check
- src/lib/constants/permissions.ts — Created: All 50+ named permission constants and role mappings
- src/lib/utils/permissions.ts — Created: Server-side hasPermission utility
- src/hooks/usePermissions.ts — Created: Client-side usePermissions hook
- src/hooks/useInactivityTimer.ts — Created: Inactivity timer hook
- src/lib/services/audit.service.ts — Created: Audit log writing service
- src/lib/services/email.service.ts — Created: Email sending service
- src/lib/rate-limit.ts — Created: In-memory sliding window rate limiter
- src/components/shared/PinEntryModal.tsx — Created: Reusable PIN numpad modal
- src/components/shared/ScreenLockOverlay.tsx — Created: Full-viewport screen lock overlay
