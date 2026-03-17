# Task 01.02.03 — Build Login Page

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_02 (NextAuth.js configured and signIn available)

---

## Objective

Build the main credential-based login page at src/app/(auth)/login/page.tsx, styled exclusively with the VelvetPOS design system — espresso, linen, mist, sand, and pearl palette — using React Hook Form with Zod for client-side validation, signIn for submission, and role-based redirect on success.

---

## Instructions

### Step 1: Confirm the Auth Route Group Layout

Verify that the directory src/app/(auth)/ exists and contains a layout.tsx file (created as part of SubPhase 01.01 directory structure). The auth layout should render a full-viewport centered container with the pearl color (--color-pearl) as the background. If the layout does not yet exist, create it now: a simple server component that wraps its children in a full-height flex container centered both horizontally and vertically, with the pearl background applied via a Tailwind CSS utility class referencing the custom color token.

### Step 2: Create the Login Page File

Create the file src/app/(auth)/login/page.tsx. This must be a Client Component (the "use client" directive is required at the top of the file) because it uses React Hook Form, client-side state, and the signIn function from next-auth/react.

### Step 3: Define the Zod Validation Schema

Inside the login page module, define a Zod schema for the login form. The schema should have two fields: email (validated as a valid email address with a descriptive error message) and password (a non-empty string with a minimum length of 1 character and a descriptive error message for empty submission). This schema is passed to the useForm resolver via the Zod resolver from @hookform/resolvers/zod.

### Step 4: Build the Form Structure

Use the useForm hook with the Zod resolver and the login schema as the resolver type argument. The form renders inside a ShadCN/UI Card component. The Card should have a linen background (--color-linen) and a mist border (--color-mist applied via a border utility). Set the Card to a fixed maximum width of around 400 pixels and apply a subtle box shadow to lift it from the pearl background.

At the top of the Card, place the VelvetPOS brand section: a placeholder logo mark (a square espresso-colored box or SVG placeholder) followed by the heading "VelvetPOS" in Playfair Display font, espresso color (--color-espresso), at a large display size. Below the heading, place a small subheading in Inter font, terracotta color (--color-terracotta), reading "Sign in to your account".

### Step 5: Add the Email and Password Fields

Use the ShadCN/UI FormField, FormItem, FormLabel, FormControl, FormMessage, and Input components wrapped by the Form component from the hook form provider. The email field label should read "Email address". The Input component should have its type set to "email", autocomplete set to "email", and a focus ring using the sand color (--color-sand). The password field label should read "Password". The Input component should have its type set to "password" with autocomplete set to "current-password" and the same sand focus ring. Field-level validation errors from React Hook Form should render below each input using FormMessage in a danger color (--color-danger).

### Step 6: Add the Forgot Password Link

Below the password field, add a right-aligned anchor element linking to /forgot-password. The link text reads "Forgot password?" in a small Inter font, terracotta color, with an underline on hover. Ensure this element does not inhibit form submission when pressed.

### Step 7: Add the Submit Button

Place a full-width Button component below the form fields. The Button's variant should apply an espresso background (--color-espresso) and pearl text on default state, transitioning to a slightly lighter espresso shade on hover (achieved via the terracotta token or an opacity modifier). The Button label reads "Sign in". When the form is submitting, disable the Button and show a loading indicator — a simple animated spinner or the text "Signing in…" is sufficient.

### Step 8: Implement the Submission Handler

The onSubmit handler passed to handleSubmit should call the signIn function from next-auth/react with the provider name "credentials", the form values spread as additional arguments, and the option redirect set to false so Auth.js returns a result object rather than performing a server-side redirect. The call is awaited. If the result object's error property is present, map the error code to a human-readable message: "CredentialsSignin" maps to "Invalid email or password. Please try again.", "TOO_MANY_ATTEMPTS" maps to a message explaining rate limiting and asking the user to wait 15 minutes. Display this error message in a terracotta-colored error alert below the submit button, not inside an individual field. If the result has no error, read session.user.role from the updated session (retrieved via an immediate getSession call or a redirect with useRouter). Redirect SUPER_ADMIN to /superadmin/dashboard and all other roles to /dashboard using Next.js router.push.

### Step 9: Handle the sessionExpired Query Parameter

Read the URL search parameters using the useSearchParams hook. If the sessionExpired parameter is present and equals "true", display an informational banner above the login form — styled with a sand background and espresso text — reading "Your session has expired or was invalidated. Please sign in again." This banner is shown automatically when the middleware redirects a user after session version mismatch.

### Step 10: Ensure Full Responsiveness

The login card should be full-width on mobile viewports and fixed-width (around 400px) on tablet and desktop viewports. Padding inside the card should be generous on desktop (around 2rem) and slightly reduced on mobile. Test the layout at 375px, 768px, and 1280px viewport widths to confirm readability and correct stacking of all elements.

---

## Expected Output

- src/app/(auth)/login/page.tsx is a Client Component with full Zod-validated React Hook Form login form
- The page is styled using the VelvetPOS espresso-linen-sand palette exclusively
- Successful login redirects SUPER_ADMIN to /superadmin/dashboard and all other roles to /dashboard
- Invalid credentials display an inline error message in the terracotta danger style
- The "sessionExpired=true" query parameter shows an info banner above the form
- The forgot password link navigates to /forgot-password
- The form is fully responsive across mobile, tablet, and desktop viewports

---

## Validation

- [ ] The "use client" directive is present at the top of login/page.tsx
- [ ] The Zod schema validates that email is a valid email address and password is non-empty
- [ ] Submitting the form with empty fields shows validation error messages per field
- [ ] Submitting with invalid credentials shows the "Invalid email or password" error message
- [ ] Submitting with valid OWNER credentials redirects to /dashboard
- [ ] Submitting with valid SUPER_ADMIN credentials redirects to /superadmin/dashboard
- [ ] The submit button is disabled and shows a loading state during form submission
- [ ] The sessionExpired=true query param triggers the expiry banner above the form
- [ ] The "Forgot password?" link navigates correctly to /forgot-password
- [ ] The page looks correct and readable at 375px, 768px, and 1280px viewport widths
- [ ] pnpm tsc --noEmit passes without errors in this file

---

## Notes

- The signIn function from next-auth/react should always be called with redirect: false on the login page. Without this option, Auth.js performs a server-side redirect that prevents the client from catching and displaying errors inline.
- The role-based redirect after login must use the session obtained after signIn completes. Call getSession or trigger a session refresh before reading the role, as the session may not be immediately updated in the React component state after signIn.
- Do not store the raw password in any React state variable. React Hook Form's internal field state holds the value only during the form lifecycle and is cleared on reset.
- The terracotta error styling for form-level errors should be distinct from the danger red used for destructive actions. Use --color-terracotta for general form errors and --color-danger for truly destructive confirmations elsewhere in the app.
- If the ShadCN/UI Form components are not yet installed, run pnpm dlx shadcn@latest add form input button card to add them before building this page.
