# Task 01.02.04 — Implement PIN Login Flow

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_02 (NextAuth.js configured; Credentials provider active)

---

## Objective

Create the full-page PIN login page at src/app/(auth)/pin-login/page.tsx, the reusable PinEntryModal component, and the PIN authentication API route at src/app/api/auth/pin/route.ts — enabling 4-digit PIN-based sessions for quick POS terminal access and the in-session screen lock flow.

---

## Instructions

### Step 1: Plan the PIN Login User Flow

The PIN login flow supports two contexts. First, the standalone pin-login page is used when a user navigates to /pin-login directly or is redirected there for quick access on a shared POS device. Second, the PinEntryModal component is embedded inside the ScreenLockOverlay (Task 01.02.08) that appears after inactivity on the POS terminal. In both contexts, the same 4-digit numpad UI and the same API route are used. Building the modal as a reusable component is therefore a prerequisite for Task 01.02.08.

### Step 2: Create the PinEntryModal Component

Create the file src/components/shared/PinEntryModal.tsx as a Client Component. The component accepts the following props: an onSuccess callback (called with no arguments when PIN verification succeeds), an onCancel callback (called when the user dismisses the modal where applicable), a userDisplayName string (the name or email of the user whose PIN is being verified, shown above the numpad), a userEmail string (used internally as the identifier sent to the API route), and an optional isOverlay boolean that controls whether the component renders as a full-screen fixed overlay or as an inline block.

The UI of PinEntryModal consists of:

A display area showing four circular dot indicators. Each dot is an outlined circle (mist border, linen background) approximately 14–16px in diameter. As the user enters digits, each dot fills with the espresso color (--color-espresso) from left to right. The dots give visual feedback without revealing the actual digit values.

A 12-key numpad grid arranged in four rows. The first three rows each contain three digit buttons for digits 1 through 9 in the standard telephone layout (1-2-3, 4-5-6, 7-8-9). The fourth row contains a backspace button on the left, the digit 0 in the centre, and a submit button on the right. Each numpad digit key has an espresso background, pearl text, rounded corners, and a terracotta hover state. The backspace key is styled more subtly with a mist background. The submit button is styled with the success green (--color-success) background and pearl text, and it remains visually disabled (reduced opacity, no hover effect) until exactly 4 digits have been entered.

Below the numpad, if the component is being used in the standalone page context (not the overlay mode), provide a link to /login reading "Sign in with password instead" in small terracotta text.

Manage the entered digits as a local state array of string characters. On each digit button press, append the digit to the array if the array length is less than 4. On backspace, remove the last digit. On submit (when length equals exactly 4), join the digits into a single string and call the internal handleSubmit function.

### Step 3: Implement the PinEntryModal Submit Logic

The handleSubmit function inside PinEntryModal should call a POST request to /api/auth/pin, sending a JSON body with the fields email (the userEmail prop) and pin (the 4-digit string). On a successful response (HTTP 200), call signIn from next-auth/react with the credential data returned by the API to create the client-side session, then invoke the onSuccess prop callback. On a non-200 response, show an error message below the numpad in danger color (--color-danger). After any error, clear the entered digits so the user can retry. Do not reveal whether the failure was due to an incorrect PIN or a non-existent user in the error message — use a generic "Incorrect PIN" message.

### Step 4: Create the Standalone PIN Login Page

Create src/app/(auth)/pin-login/page.tsx as a Client Component. This page wraps PinEntryModal in the standard auth layout context. It reads an optional email query parameter from the URL (for cases where the user arrives at pin-login with a pre-filled email). Above the modal, place the VelvetPOS logo and the "VelvetPOS" heading (same treatment as the login page). After a successful PIN entry, redirect the user to /dashboard (or /superadmin/dashboard for SUPER_ADMIN) using router.push, reading the role from the refreshed session.

### Step 5: Create the PIN Authentication API Route

Create the directory src/app/api/auth/pin/ and inside it create route.ts as a Next.js Route Handler. This file exports an async POST function.

The POST handler receives the request, parses the JSON body, and validates it against a Zod schema requiring email (valid email format) and pin (exactly 4 numeric characters using a regex pattern like /^\d{4}$/). If validation fails, return a 400 JSON response with a descriptive error.

Apply the rate limiter from src/lib/rate-limit.ts using the key "pin:{ip}" where {ip} is extracted from the x-forwarded-for or x-real-ip request header. If the rate limit is exceeded, return a 429 JSON response immediately before any database operations.

Query the database for a User where email matches, deletedAt is null, and isActive is true. Select the id, email, role, tenantId, pin, and sessionVersion fields. If no user is found, increment the rate limit counter for the IP and return a generic 401 JSON response (to avoid email enumeration, do not distinguish "user not found" from "wrong PIN" in the response).

Check that the User's pin field is not null. If pin is null, return a 401 JSON response with a generic "PIN not configured" message.

Call bcrypt.compare from bcryptjs to compare the submitted pin string against the stored pin hash. If the comparison returns false, increment the rate limit counter and return a 401 JSON response.

On a successful comparison, return a 200 JSON response containing a minimal user profile (id, email, role, tenantId) that the client-side PinEntryModal can pass to signIn. Do not include any password hash, pin hash, or session token in the response body.

### Step 6: Style the Numpad for the POS Terminal Context

The numpad keys should be large enough to be easily tappable on a touchscreen — approximately 64px by 64px minimum touch target. When the component is used in isOverlay mode (the screen lock), the background behind the numpad should be a semi-transparent espresso overlay covering the full viewport, with the numpad card centered on screen. This ensures that the underlying POS terminal UI (with the preserved cart) is partially visible beneath the overlay, reminding the cashier that their session is locked rather than logged out.

---

## Expected Output

- src/components/shared/PinEntryModal.tsx renders a 4-dot indicator and 12-key numpad with full interaction logic
- src/app/(auth)/pin-login/page.tsx presents the standalone PIN login page with the VelvetPOS brand styling
- src/app/api/auth/pin/route.ts validates, rate-limits, and authenticates PIN submissions
- Correct PIN input creates a valid NextAuth session and redirects to the appropriate dashboard
- Incorrect PIN clears the entry and shows a generic error (no user enumeration)
- The component is visually styled with the espresso-pearl numpad and success-green submit button
- The modal variant renders as a full-screen espresso overlay suitable for the POS lock screen

---

## Validation

- [ ] PinEntryModal renders four dot indicators that fill left-to-right as digits are entered
- [ ] Backspace button removes the last entered digit and unfills the corresponding dot
- [ ] Submit button is visually disabled until exactly 4 digits have been entered
- [ ] Submitting a correct PIN calls the API and then invokes the onSuccess callback
- [ ] Submitting an incorrect PIN clears the digits and shows "Incorrect PIN" in danger color
- [ ] Entering 5 or more digits is not possible — digit buttons become inert after 4 are entered
- [ ] The API route rejects requests where the pin field is not exactly 4 numeric characters
- [ ] The API route returns HTTP 429 after 10 failed attempts from the same IP in 15 minutes
- [ ] A user with no PIN set (pin field is null) receives the same generic 401 response
- [ ] The standalone pin-login page renders correctly at mobile, tablet, and desktop viewports
- [ ] pnpm tsc --noEmit passes without errors in all new files

---

## Notes

- PIN values must never be logged, stored in plain text, or transmitted in any response body. The POST body to /api/auth/pin carries the plain PIN only over HTTPS and only for the duration of the single request.
- The bcrypt comparison for a 4-digit PIN is fast but still provides brute-force resistance because all 10,000 possible combinations must be checked against the bcrypt hash one by one. Combined with rate limiting, this is sufficient protection for a POS-context PIN.
- The standalone pin-login page and the modal variant share identical API and state logic. The only difference is the visual container (full page vs. overlay). Prefer passing a prop to toggle the container style rather than duplicating the component.
- In the POS lock screen context (isOverlay mode), the PinEntryModal should verify the PIN of the currently logged-in user only. The userEmail prop should always be pre-filled with the current session user's email, and the UI should not allow changing it.
- Touch targets for the numpad keys must meet the WCAG 2.1 minimum of 44px by 44px. The recommended 64px target improves usability on smaller touchscreens common in Sri Lankan retail POS deployments.
