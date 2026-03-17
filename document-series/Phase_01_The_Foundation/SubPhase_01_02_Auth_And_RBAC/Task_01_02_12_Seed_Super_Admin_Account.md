# Task 01.02.12 — Seed Super Admin Account

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Low
- **Dependencies:** Task_01_02_01 (User model with UserRole enum exists in the database)

---

## Objective

Implement an idempotent Super Admin account seeder in prisma/seed.ts that creates the first platform-level SUPER_ADMIN user when run in development, reads credentials from environment variables, and loudly warns the developer if default placeholder credentials are being used.

---

## Instructions

### Step 1: Review the Existing Seed File

Open prisma/seed.ts. This file was initially created in SubPhase 01.01 as part of the Prisma seed script setup (Task 01.01.11). Review its current content. It may already contain a basic structure with a main function and a call to prisma.$disconnect() in the finally block. Add the Super Admin seeding logic within the existing main function, below any existing seed logic.

Confirm that the package.json file contains the prisma.seed configuration pointing to prisma/seed.ts (or the compiled output, depending on whether ts-node or tsx is used to run the seed script). The SubPhase 01.01 setup should have established this. If it is missing, add a "prisma" key to package.json with a nested "seed" key pointing to "ts-node prisma/seed.ts" or "tsx prisma/seed.ts" depending on the project's TypeScript execution setup.

### Step 2: Add Environment Variable Documentation

Open .env.example (or .env.local.example if that is the project convention) and add two new variable entries with placeholder values and comments:

Add SEED_SUPER_ADMIN_EMAIL with a placeholder value of "superadmin@velvetpos.dev" and a comment reading "# Email address for the seeded Super Admin account. Change this before production deployment."

Add SEED_SUPER_ADMIN_PASSWORD with a placeholder value of "changeme123!" and a comment reading "# Initial password for the seeded Super Admin account. Change this immediately after first login. Never use this value in production."

In .env.local, add these two variables with appropriate development-only values. Do not commit .env.local to version control.

### Step 3: Implement the Super Admin Seeding Logic

Inside the main function of prisma/seed.ts, implement the following logic:

Read the SEED_SUPER_ADMIN_EMAIL environment variable from process.env. If the variable is not set, use the fallback value "superadmin@velvetpos.dev". Read the SEED_SUPER_ADMIN_PASSWORD environment variable. If not set, use the fallback value "changeme123!".

Check whether either value is the known default placeholder. If the email equals "superadmin@velvetpos.dev" or the password equals "changeme123!", print a prominent warning to the console. The warning should use clear formatting to stand out in terminal output — for example, wrap it in lines of dashes and use the word "WARNING" in capitals. The message should read: "WARNING: Using default Super Admin credentials. These must be changed before any production or staging deployment. Do not use these values in a live environment." Print the warning regardless of the current NODE_ENV value, since even a development seeder running with defaults should prompt the developer to read the documentation.

Perform the idempotency check: call prisma.user.findUnique where email equals the resolved Super Admin email. If a user record is found, log a message to the console reading "Super Admin account already exists. Skipping creation." and return from the seeder function early without making any changes. This ensures that running the seeder multiple times (for example, in CI after a full database reset) does not create duplicate accounts or overwrite an existing Super Admin's password.

If no existing user is found, generate the password hash: call bcrypt.hash from bcryptjs with the resolved password and a cost factor of 12. Construct the User create payload with the following values:

- email: the resolved Super Admin email address
- passwordHash: the bcrypt hash just generated
- pin: null (Super Admin has no PIN — PIN login is for store staff only)
- role: UserRole.SUPER_ADMIN imported from @prisma/client
- permissions: an empty array (SUPER_ADMIN bypasses the permissions system)
- isActive: true
- tenantId: null (Super Admin has no tenant affiliation)
- sessionVersion: 1

Call prisma.user.create with this payload. After the record is created, log a success message to the console reading "Super Admin account created successfully. Email: {email}" where {email} is the actual email used. Do not log the password in any form — not plain text, not hashed.

### Step 4: Update the README

Open the project README.md and locate or create a section titled "Development Setup" or "Database & Seeding". Add the following information in prose form, without code block formatting:

Document that the seed command is pnpm prisma db seed and that it creates the initial Super Admin account. Explain that the credentials are controlled by the SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD environment variables and that they must be changed before any deployed environment. Reference the .env.example file for the variable names and placeholder values. Include a note that the seeder is idempotent and safe to run multiple times.

Also document that the recommended first-run workflow is: configure DATABASE_URL, run pnpm prisma migrate dev to apply all migrations, run pnpm prisma db seed to create the Super Admin, then start the development server with pnpm dev and log in with the seeded credentials.

### Step 5: Run the Seeder and Verify

From the project root, run pnpm prisma db seed. Observe the console output. Confirm that:

The warning message about default credentials is printed if the default values are in use.
The "Super Admin account created successfully" message appears.
The database now contains a User record with the SUPER_ADMIN role, isActive: true, and tenantId: null.

Run pnpm prisma db seed a second time with the same credentials. Confirm that the "skipping creation" message appears and that no new User record is created and no error is thrown.

Start the development server with pnpm dev. Navigate to http://localhost:3000/login. Enter the Super Admin credentials. Confirm that the login succeeds and the application redirects to /superadmin/dashboard (or /dashboard if the superadmin route group is not yet built — the redirect path will be refined in Phase 2).

### Step 6: Confirm TypeScript Compilation

Run pnpm tsc --noEmit from the project root. Confirm there are no TypeScript errors in prisma/seed.ts. Common issues to watch for: importing UserRole from @prisma/client (confirm the enum is exported after regeneration), and the bcrypt.hash call return type being correctly typed as a Promise resolving to a string.

---

## Expected Output

- prisma/seed.ts contains idempotent Super Admin seeding logic that reads credentials from environment variables
- Running the seeder creates the Super Admin account on the first run and skips on subsequent runs
- A warning is printed when default development credentials are detected
- .env.example documents SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD with placeholder values
- The README documents the seed command and the recommended first-run development workflow
- The seeded Super Admin account can successfully log into the application

---

## Validation

- [ ] Running pnpm prisma db seed creates a User record with role SUPER_ADMIN and tenantId null
- [ ] Running pnpm prisma db seed a second time logs "skipping creation" and creates no duplicate record
- [ ] The default-credentials warning is printed to the console when placeholder values are used
- [ ] The password is never logged to the console or stored in any log file
- [ ] The seeded Super Admin can log in at /login and is redirected to the superadmin area
- [ ] pnpm tsc --noEmit passes without errors in prisma/seed.ts
- [ ] .env.example contains entries for SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD with comments
- [ ] The README seed section documents the pnpm prisma db seed command and the first-run workflow

---

## Notes

- The Super Admin seeder reads from environment variables so that the same seed script can be used across development, CI, and staging environments with different credentials injected through the environment. Never hard-code real credentials in the seed file itself.
- The fallback to default development values is intentional and documented. It makes the development experience frictionless (developers can run the seeder immediately without configuring environment variables first), but the warning ensures they know to change the defaults before any real deployment.
- The Super Admin's permissions array is stored as an empty array in the database because permission checks are not applied to SUPER_ADMIN in the route middleware — access is enforced by role alone for superadmin routes. Storing an empty array rather than all permissions prevents confusion about whether the permissions field drives superadmin access.
- If the project later introduces a dedicated superadmin setup wizard (a first-run screen that prompts for credentials before the seeder runs), the prisma seed approach can be replaced or complemented by that wizard. For Phase 1, the seeder is the authoritative provisioning mechanism.
- The pnpm prisma db seed command is the standard Prisma seeding command and requires the "prisma.seed" entry in package.json to point to the seed file. If the project uses tsx for TypeScript execution (preferred over ts-node for its speed), the seed entry should read "tsx prisma/seed.ts". Confirm the executor is installed by running pnpm add -D tsx if it is not already in devDependencies.
