# Task 01.01.12 — Create Env Config and Readme

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Low |
| Dependencies | Task_01_01_01 |

## Objective

Create the .env.example file documenting every required environment variable for the VelvetPOS platform across all integrations, and write a comprehensive README.md covering setup prerequisites, installation, and all common development workflows.

## Instructions

### Step 1: Compile the Full List of Required Environment Variables

Before writing any file, compile the complete inventory of environment variables that VelvetPOS requires. Organise them into seven categories: Database (the Prisma PostgreSQL connection string), Authentication (NextAuth.js secret and public URL), PayHere payment gateway (Sri Lanka's primary payment processor), WhatsApp Business API (Meta Cloud API for receipt and notification messages), File Storage (provider selection flag plus credentials for Supabase Storage or Cloudinary), Email (Resend transactional email service), and Application (public Next.js URL and display name). Total the variable count to use as a verification checkpoint.

### Step 2: Create .env.example with the Database Section

Create the file .env.example in the project root. Confirm that .env.example is NOT listed in .gitignore — this file must be committed to source control because it contains no secrets, only placeholder values and documentation comments. Begin the file with a header comment block explaining that this file documents all required environment variables and that it should be copied to .env.local with real values filled in. Start the Database section with a comment header line reading "# ── Database ───────────────────────────────────────────────────────────". Declare DATABASE_URL with a placeholder connection string in the format "postgresql://username:password@hostname:5432/velvetpos?schema=public" and a comment above it explaining that this value must be a full Prisma-compatible PostgreSQL connection string and providing the format of a typical managed database URL.

### Step 3: Add the Authentication Section

Add a comment header for the Authentication category. Declare NEXTAUTH_SECRET with the placeholder value "your-secret-here-generate-with-openssl-rand-base64-32" and a comment instructing developers to generate this value by running the openssl command referenced in the placeholder. This secret must be a cryptographically random string of at least 32 bytes. Declare NEXTAUTH_URL with the value "http://localhost:3000" for local development and a comment noting that this value must be updated to the full production HTTPS URL when deploying to a live environment.

### Step 4: Add the PayHere Payment Gateway Section

Add a comment header for PayHere. Declare PAYHERE_MERCHANT_ID with a placeholder comment explaining it is obtained from the PayHere merchant portal after account approval. Declare PAYHERE_MERCHANT_SECRET with a placeholder and a comment warning that this value is sensitive and must never be exposed to client-side code. Declare PAYHERE_MODE with the value "sandbox" for development and a comment listing the two accepted values — "sandbox" for the test payment environment and "live" for the production payment environment.

### Step 5: Add the WhatsApp and File Storage Sections

Add the WhatsApp section with a header comment. Declare WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_BUSINESS_ACCOUNT_ID, each with placeholder values and a comment directing developers to the Meta for Developers portal to obtain these credentials after creating a WhatsApp Business account and configuring a phone number. Add the File Storage section with a header comment. Declare STORAGE_PROVIDER with the placeholder "supabase" and a comment listing the two accepted values: "supabase" (uses Supabase Storage) and "cloudinary" (uses Cloudinary CDN). Declare SUPABASE_URL and SUPABASE_ANON_KEY for the Supabase path, and CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET for the Cloudinary path. Add a comment clarifying that only one provider's variables need to be filled — those for the provider not selected by STORAGE_PROVIDER can be left as empty placeholders.

### Step 6: Add the Email and Application Sections

Add the Email section with a header comment. Declare RESEND_API_KEY with a placeholder and a comment directing developers to resend.com to obtain their API key. Declare EMAIL_FROM_ADDRESS with the placeholder "noreply@yourdomain.com" and a comment noting this must be a verified sender address in the Resend dashboard before transactional emails can be sent. Add the Application section with a header comment. Declare NEXT_PUBLIC_APP_URL with "http://localhost:3000" and a comment explaining that the NEXT_PUBLIC_ prefix makes this variable available to client-side JavaScript. Declare NEXT_PUBLIC_APP_NAME with "VelvetPOS" — this value is used in page titles, email subjects, and other user-facing display contexts.

### Step 7: Create README.md — Project Overview and Prerequisites

Create README.md in the project root. The first section should be a top-level heading "VelvetPOS" followed by a concise paragraph: VelvetPOS is a full-stack SaaS point-of-sale system for clothing retail, built with Next.js 15+, TypeScript strict mode, Prisma ORM, PostgreSQL, Tailwind CSS 4, ShadCN/UI, and NextAuth.js v5. It is designed to support multiple stores, offline-capable POS transactions, real-time inventory management, and WhatsApp receipt delivery. The second section, titled "Prerequisites", should list the minimum required tool versions as a bullet list: Node.js 20 or later, pnpm 9 or later (install globally with "npm install -g pnpm"), and PostgreSQL 15 or later (either local or a cloud-managed service such as Supabase, Railway, or Neon).

### Step 8: Create README.md — Installation and Workflow Sections

The "Installation" section should number three steps in prose: clone the repository using git clone followed by the repository URL, change into the project directory, and run "pnpm install" to install all dependencies including the automatic Prisma client generation via the postinstall hook. The "Environment Setup" section should instruct developers to copy .env.example to .env.local by running "cp .env.example .env.local" on macOS/Linux or "copy .env.example .env.local" on Windows, and fill in the values appropriate for their local environment. The "Running the Development Server" section should state that running "pnpm dev" starts the Next.js development server and the application will be available at http://localhost:3000. The "Running Prisma Migrations" section should describe "pnpm prisma migrate dev --name description-of-change" for creating new migrations in development and "pnpm prisma migrate deploy" for applying migrations in production. The "Running the Seeder" section should state that "pnpm prisma db seed" runs the seed script and note that during Phase 01 the seeder is a placeholder that only verifies database connectivity. The "Running Tests" section should state that automated testing is configured in a later sub-phase and will be documented here when available.

### Step 9: Verify Both Files

Read through .env.example and count the declared variable names. Confirm there are 21 variables in total across the seven sections. Scan for any lines that do not match the KEY=VALUE format (excluding comment lines that begin with #) and correct them. Read through README.md from start to finish as though you were a developer who just received access to the repository — confirm that following the instructions sequentially would bring a developer from zero to a running development server with a connected database without requiring any external documentation lookups.

## Expected Output

- .env.example is present in the project root and committed to source control
- .env.example documents all 21 environment variables across seven categories with descriptive comments
- No real credentials, API keys, or secret values appear anywhere in .env.example
- README.md covers all eight sections with clear, accurate instructions
- A developer following README.md can reach a running development server without additional guidance

## Validation

- [ ] .env.example is tracked by git (not in .gitignore) and can be committed
- [ ] .env.local is NOT tracked by git and does not appear in "git status" output
- [ ] .env.example contains all 21 environment variables as defined in the Technical Context of the SubPhase overview
- [ ] README.md contains the eight required sections in logical order
- [ ] All KEY=VALUE lines in .env.example are syntactically valid (no spaces around the equals sign, no unquoted special characters)

## Notes

The .env.example file is a living document. Whenever a new integration is added to VelvetPOS in future sub-phases and requires new environment variables, those variables must be added to .env.example in the same pull request that introduces the integration code. This is a team convention that should be enforced during pull request review. A useful CI check is to parse .env.example and verify that all its defined variables are documented — this can be added as a lint step in a later phase. Never use real values as examples in .env.example, even for non-sensitive variables — always use clearly fictional or placeholder strings to avoid any confusion about what constitutes a real credential.
