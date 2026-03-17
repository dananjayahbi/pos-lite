# Task 03.03.09 — Build Manager Authorization Reuse

## Metadata

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Task ID        | 03.03.09                                                               |
| Name           | Build Manager Authorization Reuse                                      |
| SubPhase       | 03.03 — Returns and Exchanges                                          |
| Status         | Not Started                                                            |
| Complexity     | LOW                                                                    |
| Dependencies   | Task_03_03_03 complete (ReturnWizardSheet shell)                       |
| Output Files   | src/components/pos/CartManagerPINModal.tsx (modified), src/app/api/auth/verify-pin/route.ts (created) |

---

## Objective

Adapt the `CartManagerPINModal` component from SubPhase_03_01_09 to serve the return authorization use case, build the `POST /api/auth/verify-pin` endpoint that both the discount override and return authorization flows depend on, and integrate the PIN step as Step 3 of the `ReturnWizardSheet`.

---

## Context

The `CartManagerPINModal` was originally built in Task_03_01_09 for discount overrides. In that context, the PIN prompt is optional — cashiers can request an override but the flow can proceed without one in some scenarios. For returns, the PIN authorization is unconditional: there is no path through the ReturnWizardSheet Step 3 that bypasses it.

To support this dual use, `CartManagerPINModal` is refactored to accept a `required` prop. When `required` is `true`, the modal title, description, and buttons change to reflect the return authorization context, and no skip or cancel path is offered at the modal level (only the parent's "Back" button allows backing away from this step).

---

## Instructions

### Step 1: Review CartManagerPINModal from Task_03_01_09

Read the existing `CartManagerPINModal` component built in SubPhase_03_01. Identify the current title, description text, PIN input behavior, and the callback signatures for success and cancellation.

### Step 2: Add the required Prop

Update `CartManagerPINModal` to accept a `required: boolean` prop (default `false`).

When `required` is `false` (discount override context, existing behavior):
- Title: "Manager Override Required"
- Description: "Enter a manager PIN to approve a discount above the cashier limit."
- A "Cancel Override" button closes the modal without returning a userId

When `required` is `true` (return authorization context):
- Title: "Manager Authorization Required"
- Subtitle: "Enter a manager PIN to authorize this return."
- No cancel or dismiss button at the modal level — the user must back-navigate via the wizard's Back button
- The modal's `onOpenChange` is overridden to prevent closing when `required` is `true` (same as the ReturnWizardSheet guard)

The PIN input, verification logic, and response handling remain identical across both modes.

### Step 3: Build POST /api/auth/verify-pin

Create `src/app/api/auth/verify-pin/route.ts`.

Request body: `{ pin: string }` (Zod-validated, pin must be a non-empty string of digits, 4–8 characters).

Handler:
1. Require a valid session. Return 401 if unauthenticated.
2. Extract `tenantId` from the session.
3. Query for a User in the same tenant where `pin` matches (the `User` model must have a `pin` field — this field was established in Phase 01 during authentication setup). Compare using a timing-safe string comparison to prevent timing attacks (use a constant-time compare function such as `crypto.timingSafeEqual`, after converting both strings to `Buffer`).
4. If a matching user is found: verify the user's role is MANAGER, OWNER, or SUPER_ADMIN. Return `{ success: true, userId: user.id, role: user.role, name: user.name }`.
5. If no matching user is found or the matching user is not a manager: return `{ success: false, error: "Invalid PIN or insufficient permissions" }`. Always return 200 for both success and failure (do not return 401/403 for PIN mismatch — rate limiting and response uniformity require a 200 status; the client reads the `success` field).

Add rate limiting to prevent PIN brute-force: allow a maximum of 5 failed attempts per session per 5-minute window. Store attempt counts in the session or a server-side in-memory Map keyed by `[tenantId]:[requestingUserId]`. On the 6th failed attempt, return `{ success: false, error: "Too many attempts. Try again in 5 minutes." }`.

### Step 4: Update CartManagerPINModal to Use verify-pin

Update the PIN submission logic in `CartManagerPINModal` to call `POST /api/auth/verify-pin` via `fetch`. On success, call the `onAuthorized(userId, managerName)` callback. On failure, display the error message returned by the API beneath the PIN input. The error message must be cleared when the user begins typing a new PIN.

### Step 5: Integrate Step 3 into ReturnWizardSheet

In `ReturnWizardSheet.tsx` (built in Task_03_03_03), replace the Step 3 placeholder content with:

- Render `CartManagerPINModal` with `required={true}` and in an always-visible inline form rather than as a modal overlay. This avoids a modal-over-modal scenario.
- When the PIN is verified, store `authorizingManagerId` and `authorizationTimestamp` (Date.now()) in wizard state.
- Show a success confirmation row: a green checkmark icon, the manager's name, and "Authorized at HH:mm". The "Process Return" button becomes active.
- If the timestamp is older than 5 minutes when "Process Return" is clicked, reset the authorization and return to the PIN input with the message "Authorization expired. Please re-enter the PIN."

---

## Expected Output

- `CartManagerPINModal` works correctly in both optional (discount) and required (return) modes
- `POST /api/auth/verify-pin` verifies PINs, enforces role, and rate-limits attempts
- ReturnWizardSheet Step 3 shows inline PIN entry with post-authorization confirmation
- Authorization expires after 5 minutes

---

## Validation

- Five failed PIN attempts lock the endpoint for 5 minutes with the correct error message
- A successful PIN from a CASHIER-role user returns `success: false` even if the PIN matches
- The authorization timeout correctly re-prompts when submitting after 5 minutes
- In discount override context (required=false), CartManagerPINModal still shows the Cancel button

---

## Notes

The `pin` field on the User model is expected to be a plaintext PIN stored in Phase 01 for simplicity. In a production-hardened deployment, PINs should be hashed. This is a known Phase 01 design decision. If the schema uses hashed PINs, update the verify-pin handler to use `bcrypt.compare` instead of direct string comparison.
