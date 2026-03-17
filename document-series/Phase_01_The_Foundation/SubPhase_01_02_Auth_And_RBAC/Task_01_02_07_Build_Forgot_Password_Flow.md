# Task 01.02.07 — Build Forgot Password Flow

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_02 (NextAuth configured; User and VerificationToken models exist)

---

## Objective

Build the complete two-step password reset flow: a forgot password page that generates a time-limited email token, and a reset password page that validates the token, hashes the new password, and invalidates existing sessions — including the email service integration and both API routes.

---

## Instructions

### Step 1: Create the Email Service

Create the file src/lib/services/email.service.ts. This service abstracts email sending from the specific email provider being used. For VelvetPOS, the recommended provider is Resend, which has a clean Node.js SDK and generous free tier. Install the SDK by running pnpm add resend from the project root. Add the RESEND_API_KEY environment variable to .env.local. Alternatively, if the project is configured to use a generic SMTP server, install nodemailer by running pnpm add nodemailer @types/nodemailer and use the provided SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.

The email.service.ts file should export a sendEmail function accepting a to address string, a subject string, and an HTML body string. Internally, it calls the chosen provider's API. Add appropriate error handling: if the email fails to send, log the error server-side but do not propagate the error to the caller in a way that reveals infrastructure details. The function should return a boolean indicating success or failure.

Also export a sendPasswordResetEmail convenience function that accepts a to address and a resetUrl string, constructs the branded VelvetPOS HTML email template (minimal — just the VelvetPOS name, a brief message, the reset link as a button or plain anchor, and an expiry notice), and calls sendEmail.

### Step 2: Create the Forgot Password API Route

Create the directory src/app/api/auth/forgot-password/ and inside it create route.ts as a Next.js Route Handler. The file exports an async POST function.

The POST handler parses the JSON request body and validates it against a Zod schema requiring the email field to be a valid email address string. If validation fails, return a 400 response.

Apply rate limiting using the rate limiter from src/lib/rate-limit.ts with the key "forgot:{ip}" and a stricter limit — for example, 5 attempts per IP per 60-minute window — to prevent token flooding.

Query the database for a User by the submitted email where deletedAt is null. Whether or not the user exists, always return an HTTP 200 response with the same body: a JSON object stating that if the email is registered, a reset link has been sent. This consistent response prevents email enumeration — an attacker cannot determine which emails are registered by analyzing the response.

If the user does exist, proceed with the following steps internally: delete any existing VerificationToken records for this user's email (to avoid multiple active reset tokens for the same account). Generate a cryptographically secure token using the Node.js crypto module: call crypto.randomBytes(32) to get 32 bytes and convert them to a hex string using toString("hex"). Set the expiry to one hour from the current time by creating a new Date and adding 3600000 milliseconds. Create a VerificationToken record in the database with identifier set to the user's email, token set to the generated hex string, and expires set to the calculated expiry Date. Construct the full reset URL as the application's base URL (from the AUTH_URL or APP_URL environment variable) followed by /reset-password?token= and the generated token. Call the sendPasswordResetEmail service function with the user's email and the reset URL.

### Step 3: Create the Forgot Password Page

Create src/app/(auth)/forgot-password/page.tsx as a Client Component. The page follows the same visual structure as the login page (pearl background, linen card, espresso heading, sand focus ring). The heading reads "Reset your password". Below the heading, add a short Inter body text explaining "Enter the email address associated with your account and we will send you a link to reset your password."

The page contains a single-field form with React Hook Form and Zod. The email field uses the same styled Input component as the login page. The submit button text reads "Send reset link" and shows a loading state during submission.

On form submit, call POST /api/auth/forgot-password with the email. Regardless of the response (success or API-level error), transition the page to a confirmation state: hide the form and show a confirmation message reading "If that email address is registered, you will receive a password reset email within a few minutes. Please check your spam folder." Showing a consistent confirmation state regardless of outcome reinforces the server-side enumeration protection.

Include a link back to /login reading "Back to sign in" at the bottom of the card.

### Step 4: Create the Reset Password API Route

Create the directory src/app/api/auth/reset-password/ and inside it create route.ts as a Next.js Route Handler. The file exports an async POST function.

The POST handler parses the JSON body and validates it against a Zod schema requiring: token (a non-empty string), newPassword (a string minimum 8 characters), and confirmPassword (a string that must match newPassword — use Zod's refine method with a custom validation).

Look up the VerificationToken in the database by the token field. If no record is found, return a 400 JSON response with an error message such as "This reset link is invalid or has already been used." If a record is found, check whether the expires Date is in the past (compare against new Date()). If the token is expired, delete the VerificationToken record and return a 400 JSON response with the message "This reset link has expired. Please request a new one."

Find the User by the VerificationToken's identifier (which is the email). If the user is not found (edge case: account deleted between token issuance and use), return a 400 response.

Hash the new password using bcrypt.hash from bcryptjs with a cost factor of 12. Update the User record: set passwordHash to the new hash. Increment the User's sessionVersion by 1 to invalidate all existing sessions (this ensures any currently logged-in devices with the old password are forced to re-authenticate). Delete the VerificationToken record to prevent token reuse. Return a 200 JSON response indicating success.

### Step 5: Create the Reset Password Page

Create src/app/(auth)/reset-password/page.tsx as a Client Component. The page reads the token query parameter from the URL using useSearchParams. If no token is present in the URL, show an error state immediately reading "This reset link is invalid" with a link to /forgot-password.

The page shows a two-field form: "New password" and "Confirm new password". Both fields use the styled Input component with type="password". The Zod schema validates that newPassword is at least 8 characters and that confirmPassword matches newPassword. Show field-level errors from React Hook Form for each field.

On submission, call POST /api/auth/reset-password with the token from the URL query parameter and the two password fields. On success, show a success banner reading "Your password has been updated. You can now sign in with your new password." and after a brief delay (around 2 seconds) redirect the user to /login. On API error (invalid or expired token), display the error message from the API response inline in the form.

---

## Expected Output

- src/lib/services/email.service.ts exports sendEmail and sendPasswordResetEmail with provider abstraction
- src/app/api/auth/forgot-password/route.ts returns HTTP 200 regardless of whether the email is registered
- src/app/api/auth/reset-password/route.ts validates the token, hashes the new password, increments sessionVersion, and deletes the used token
- src/app/(auth)/forgot-password/page.tsx shows a consistent confirmation state regardless of email existence
- src/app/(auth)/reset-password/page.tsx validates password confirmation and handles expired/invalid tokens gracefully
- Successful password reset increments the user's sessionVersion in the database

---

## Validation

- [ ] Submitting a known email on forgot-password shows the confirmation message
- [ ] Submitting an unknown email on forgot-password shows the same confirmation message (no enumeration)
- [ ] A VerificationToken with a 1-hour expiry is created in the database after a valid request
- [ ] The reset email is sent to the registered email address with a valid token link
- [ ] Submitting the correct token and matching passwords on reset-password updates the passwordHash
- [ ] Submitting an expired token returns a 400 response with the expiry error message
- [ ] Submitting a used (already deleted) token returns a 400 invalid token response
- [ ] After successful reset, the user's sessionVersion is incremented by 1
- [ ] Password confirmation mismatch shows a field error before any API call is made
- [ ] Passwords shorter than 8 characters show a field error before any API call is made
- [ ] pnpm tsc --noEmit passes without errors in all new files

---

## Notes

- The consistent response from the forgot-password endpoint (always HTTP 200 with the same message) is a deliberate security measure, not an oversight. Document this in the API route comment explaining the enumeration protection intent.
- Store the RESEND_API_KEY or SMTP credentials in .env.local and never commit them to version control. Add notes to .env.example documenting the variable names without values.
- The VerificationToken model uses a composite unique constraint on (identifier, token) — this is the NextAuth adapter convention. When creating password reset tokens, set identifier to the user's email to make it easy to delete all tokens for a given email before issuing a new one.
- Incrementing sessionVersion on password reset is essential. Without it, a former attacker who obtained a session token (for example, from a compromised device) remains logged in even after the password is changed. The middleware's version check will boot them on their next request.
- For development testing, configure the email service to log the email content to the terminal console instead of actually sending it. Many email SDK clients support a test/sandbox mode. This avoids needing a real email account during local development.
