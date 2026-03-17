# Task 04.02.03 — Build PIN Management UI

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.03 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Depends On | 04.02.02 (staff detail page shell), Phase 01 NextAuth credential flow |
| Produces | PIN set/reset API route, PinManagement tab component |
| Owner Role | Full-Stack Developer |

---

## Objective

Allow Managers and Owners to securely set or reset a staff member's PIN from the staff detail page. The PIN is used for quick cashier login at the POS terminal (established in Phase 01). This task replaces the placeholder PinManagement tab component with a functional implementation and creates the secure API route that performs the hashing and storage operation.

---

## Context

Phase 01 introduced hashedPin on the User model and the PIN login flow for cashier authentication. The PIN is hashed using bcrypt before storage and never returned in any API response. This task manages PIN lifecycle — initial creation, reset by a manager, and automatic clearing on soft delete. The PIN input must accept 4 to 8 numeric digits only to match the terminal login keypad.

---

## Instructions

### Step 1: Create the PIN Management API Route

Create src/app/api/staff/[id]/pin/route.ts with a single PATCH handler. Authenticate the session and confirm the requesting user has MANAGER or OWNER role. Confirm the [id] in the route corresponds to a User in the same tenant as the requester — reject with 403 if the tenant does not match. Accept a newPin field in the request body. Validate that newPin is a string of 4 to 8 numeric digits using a Zod schema with a regex pattern — reject with 400 and a descriptive error message if validation fails. Hash the validated PIN using bcrypt with a cost factor of 12. Update the User record's hashedPin field with the hash. Return a 200 response with only a success message and the timestamp — do not return the hash, the raw PIN, or any User credential fields in the response body.

### Step 2: Create the PIN Clear Route (Soft Delete Integration)

Open the existing PATCH handler in src/app/api/staff/[id]/route.ts. Add handling for a deletedAt soft-delete action: when isActive is set to false and a clearPin flag is passed as true in the request body, additionally set hashedPin to null on the User record. This ensures that deactivated staff cannot log in via PIN even if their isActive toggle is later re-enabled without a Manager explicitly re-assigning a PIN. Document this behaviour with a comment in the handler.

### Step 3: Build the PinManagement Tab Component

Replace the placeholder component at src/app/dashboard/[tenantSlug]/staff/[staffId]/components/PinManagement.tsx with a full implementation. The component is a client component. It renders a ShadCN Card with a heading "PIN Management" in Playfair Display. Below the heading, show the current PIN status: if hashedPin is not null, display "PIN is set" with a shield icon in sand (#CBAD8D); if hashedPin is null, display "No PIN assigned" with a warning icon in terracotta (#A48374).

### Step 4: Build the PIN Input Form

Within PinManagement.tsx, render a form managed by react-hook-form and Zod. The form contains a single field labelled "New PIN" rendered as a password-type text input to obscure digit entry. Add a confirm PIN field labelled "Confirm PIN" for the user to re-enter the PIN to catch transcription errors. Client-side validation checks that both fields match and that the PIN is 4 to 8 digits. On form submission, call PATCH /api/staff/[id]/pin with the newPin value. Use useMutation from TanStack Query, and on success show a ShadCN toast notification: "PIN updated successfully." On error, surface the server error message within the form.

### Step 5: Display Contextual Role Guard

Within PinManagement.tsx, read the current session role using useSession from NextAuth. If the session role is CASHIER or STOCK_CLERK, render only a descriptive paragraph — "Only Managers and Owners can manage staff PINs" — without the PIN form. This prevents route-level bypass attempts by lower-privilege users who navigate directly to the staff detail URL.

### Step 6: Handle the Self-PIN Scenario

If the [staffId] route parameter matches the authenticated user's own ID, and the session role is CASHIER or STOCK_CLERK, still hide the form. If the session role is MANAGER or OWNER and the staffId matches their own profile, allow the form — senior staff may update their own PIN. Document this edge case with a comment in the component.

---

## Expected Output

- PATCH /api/staff/[id]/pin validates the PIN, hashes it, and stores it without exposing credentials in the response
- The PinManagement tab on the staff detail page renders the current PIN status and an input form for Manager/Owner roles
- Submitting the form with a valid PIN shows a success toast
- Submitting with mismatched or out-of-range PINs shows inline validation errors before the request is made
- Lower-privilege roles see only the "Managers and Owners only" message

---

## Validation

- As an OWNER, navigate to a CASHIER's detail page, open the PIN Management tab, enter and confirm a valid 6-digit PIN, and submit — confirm success toast appears
- Attempt to submit a 3-digit PIN — confirm client-side validation error appears without a network request
- Attempt to submit two mismatched PINs — confirm "PINs do not match" validation error
- Using curl or an API client, send a PATCH request to /api/staff/[id]/pin while authenticated as a CASHIER — confirm a 403 response is returned
- Confirm hashedPin in the database is a bcrypt hash string and does not contain the raw PIN digits
- Log in to the POS terminal using the newly set PIN — confirm authentication succeeds

---

## Notes

- Never log the raw PIN value in any server-side console, error report, or audit log entry. Log only the staff ID and the action "pin_updated" with the authorizedById.
- The bcrypt cost factor of 12 is deliberately chosen to balance security and response time at the POS terminal. Do not reduce it below 10.
- Consider adding a rate limit on the PIN endpoint (5 attempts per minute per IP) once the rate-limiting middleware from Phase 01 is in place, to prevent brute-force setting of another user's PIN even by authenticated managers.
