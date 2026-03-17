# Task 01.02.02 — Configure NextAuth Credentials

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_01 (User and AuditLog models must exist in the database)

---

## Objective

Install NextAuth.js v5 (Auth.js) and the Prisma adapter, then create the complete authentication configuration in src/lib/auth.ts including the Credentials provider with full validation logic, JWT and session callbacks, and the route handler — and augment TypeScript types so the session object exposes all application-specific user fields.

---

## Instructions

### Step 1: Install Required Packages

From the project root, run pnpm add next-auth@beta @auth/prisma-adapter to install NextAuth.js v5 (the Auth.js rewrite) and the official Prisma adapter. NextAuth v5 is distributed under the beta tag and is the version compatible with Next.js App Router. After installation, confirm both packages appear in package.json under dependencies.

### Step 2: Add Required Environment Variables

Open the .env.local file and add the AUTH_SECRET variable. This must be a long, cryptographically random string used to sign and encrypt JWT tokens. Generate a suitable value by running pnpm dlx auth secret in the terminal, which outputs a ready-to-use value, or by generating 32+ random bytes using any secure method. Also confirm that AUTH_URL is set to the application's base URL (for example http://localhost:3000 in development). These variables are consumed automatically by Auth.js when following the AUTH_ prefix convention.

### Step 3: Create the Prisma Client Singleton

Confirm that src/lib/prisma.ts already exports a singleton PrismaClient instance (created in SubPhase 01.01). This singleton is the database client that the NextAuth configuration and all other server-side code will import. Do not create a new PrismaClient instance inside auth.ts; always import from the centralized singleton to avoid connection pool exhaustion in development hot-reload cycles.

### Step 4: Create src/lib/auth.ts

Create the file src/lib/auth.ts. This file is the central NextAuth.js configuration module. It must export the named exports that Auth.js requires: handlers (the GET and POST route handlers), auth (the session accessor for server components and middleware), signIn, and signOut.

Configure the Auth.js instance with the following settings:

Pass the PrismaAdapter from @auth/prisma-adapter, providing the shared Prisma client instance, as the adapter option.

Set the session strategy to "jwt" so that sessions are stored entirely in the signed JWT token rather than in the database session table for every request. The Prisma Session table is still created for adapter compatibility but the primary session mechanism is JWT.

Define the Credentials provider. The provider accepts two fields: email (a text input) and password (a password input). The authorize async function receives credentials and request arguments. Inside authorize, first validate the incoming credentials object against a Zod schema that requires email to be a valid email address and password to be a non-empty string of at least 1 character. If Zod validation fails, throw a CredentialsSignin error. Next, query the database for a User where email matches and deletedAt is null, selecting the id, email, passwordHash, role, permissions, tenantId, isActive, and sessionVersion fields. If no user is found, throw a CredentialsSignin error with a generic message to avoid leaking whether the email is registered. Compare the provided password against passwordHash using bcrypt.compare from the bcryptjs package. If the comparison returns false, throw a CredentialsSignin error. If the user's isActive field is false, throw a CredentialsSignin error indicating the account is inactive. On successful validation, return a plain object containing the user's id, email, role, permissions, tenantId, and sessionVersion. Do not return the passwordHash.

Define the jwt callback. This callback fires when a JWT token is created or updated. When the trigger is "signIn" or when the user object is present in the callback arguments (meaning it is the initial sign-in), copy the role, permissions, tenantId, and sessionVersion values from the user object into the token object. Return the modified token. On subsequent requests, the token already contains these fields, so no database call is needed.

Define the session callback. This callback fires when a session is accessed via the auth() function or useSession hook. Copy the token's id, role, permissions, tenantId, and sessionVersion values into the session.user object. Return the modified session. This ensures client components and server components receive a fully populated session.

Set the pages option to point sign-in to "/login" so Auth.js redirects unauthenticated users to the correct custom login page rather than the default Auth.js page.

### Step 5: Create the Route Handler

Create the directory src/app/api/auth/[...nextauth]/ and inside it create route.ts. This file should import the handlers object exported from src/lib/auth.ts and export handlers.GET as GET and handlers.POST as POST. This is the standard Auth.js v5 pattern for the App Router.

### Step 6: Augment TypeScript Types

Create the file src/types/next-auth.d.ts. Inside this file, use TypeScript declaration merging to augment the "next-auth" module. Extend the Session.user interface to include the additional fields that the session callback embeds: id as a string, role as the UserRole enum imported from @prisma/client, permissions as a string array, tenantId as a string or null, and sessionVersion as a number. Similarly augment the JWT interface in the "next-auth/jwt" module to include the same fields. This ensures TypeScript understands the shape of the session and token objects throughout the codebase without requiring type assertions.

### Step 7: Verify Type Correctness

Run pnpm tsc --noEmit from the project root. Confirm there are no TypeScript errors related to the new auth.ts, route.ts, or next-auth.d.ts files. Pay particular attention to the return type of the authorize function — it must satisfy the User type that Auth.js expects.

### Step 8: Smoke-Test the Configuration

Start the development server with pnpm dev and navigate to http://localhost:3000/login in the browser. The page should either render the custom login page (if Task 01.02.03 is already complete) or redirect to the default Auth.js sign-in page, confirming that the route handler is wired correctly. Use the browser network tab to confirm that requests to /api/auth/session return a JSON response without a 500 error.

---

## Expected Output

- next-auth@beta and @auth/prisma-adapter are listed in package.json dependencies
- AUTH_SECRET and AUTH_URL are present in .env.local
- src/lib/auth.ts exports handlers, auth, signIn, and signOut with full Credentials provider logic
- src/app/api/auth/[...nextauth]/route.ts exports GET and POST using the handlers from auth.ts
- src/types/next-auth.d.ts augments Session.user and JWT with role, permissions, tenantId, and sessionVersion
- pnpm tsc --noEmit passes without errors
- The /api/auth/session endpoint responds with a valid JSON object when the dev server is running

---

## Validation

- [ ] pnpm add next-auth@beta @auth/prisma-adapter completes without peer dependency conflicts
- [ ] AUTH_SECRET is present in .env.local and is at least 32 characters in length
- [ ] src/lib/auth.ts imports PrismaAdapter and the Prisma singleton without creating a new PrismaClient
- [ ] The Credentials authorize function validates inputs with Zod before any database call
- [ ] The authorize function returns null (or throws CredentialsSignin) for invalid credentials without leaking database details
- [ ] The jwt callback embeds role, permissions, tenantId, and sessionVersion into the token on sign-in
- [ ] The session callback copies those fields from the token into session.user
- [ ] src/types/next-auth.d.ts extends Session.user with all application-specific fields
- [ ] pnpm tsc --noEmit passes with zero errors
- [ ] GET /api/auth/session returns HTTP 200 with a JSON body when tested in the browser

---

## Notes

- NextAuth v5 uses the AUTH_ prefix convention for environment variables, so AUTH_SECRET and AUTH_URL are picked up automatically without explicit configuration. Do not use NEXTAUTH_SECRET or NEXTAUTH_URL as those are the v4 convention.
- The CredentialsSignin error class is imported from the "next-auth/errors" module in v5. Always throw this specific error type rather than a generic Error to ensure NextAuth handles it correctly and does not expose stack traces to the client.
- Always use bcryptjs rather than the native bcrypt package for password comparison. bcryptjs is a pure JavaScript implementation that works without native Node.js bindings, making it compatible with edge runtimes and serverless environments.
- Never include passwordHash, pin, or any other sensitive field in the object returned by authorize or embedded in the JWT. The token is signed but not encrypted by default in Auth.js v5; its payload is readable if extracted from the cookie.
- The permissions field on the User model is a Prisma Json type. When it arrives in the authorize callback, cast or validate it as string[] before embedding it in the token to ensure type safety downstream.
