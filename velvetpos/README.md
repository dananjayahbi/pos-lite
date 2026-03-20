# VelvetPOS

A modern, multi-tenant SaaS Point-of-Sale platform designed for clothing and apparel retailers. Built with Next.js 15+, Prisma 7, and Tailwind CSS v4.

---

## Project Overview

VelvetPOS provides a complete POS terminal, inventory management, CRM, supplier management, staff administration, and a SuperAdmin console — all delivered as a SaaS product with per-tenant isolation.

**Tech Stack**

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Framework     | Next.js 16 (App Router, TypeScript)     |
| Styling       | Tailwind CSS v4 + ShadCN/UI             |
| Database ORM  | Prisma 7 + PostgreSQL 15                |
| Auth          | NextAuth.js v5 (Auth.js, credentials + PIN) |
| Server State  | TanStack Query v5                       |
| Client State  | Zustand v5                              |
| Package Mgr   | pnpm                                    |

---

## Prerequisites

Ensure the following are installed before continuing:

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 — install with `npm install -g pnpm`
- **PostgreSQL** >= 15 — running locally or via a managed provider (Supabase, Neon, Railway, etc.)

---

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd velvetpos

# 2. Install dependencies (automatically runs `prisma generate` via postinstall)
pnpm install

# 3. Copy the environment template and fill in your values
cp .env.example .env.local
```

---

## Environment Setup

Open `.env.local` and update every value. The required variables are:

| Variable                       | Purpose                                                        |
|--------------------------------|----------------------------------------------------------------|
| `DATABASE_URL`                 | PostgreSQL connection string                                   |
| `AUTH_SECRET`                  | Auth.js signing secret (`pnpm dlx auth secret`)                |
| `AUTH_URL`                     | Canonical app URL (`http://localhost:3000` locally)            |
| `PAYHERE_MERCHANT_ID`          | PayHere merchant identifier                                    |
| `PAYHERE_MERCHANT_SECRET`      | PayHere signing secret                                         |
| `PAYHERE_MODE`                 | `sandbox` or `live`                                            |
| `WHATSAPP_ACCESS_TOKEN`        | Meta Cloud API access token                                    |
| `WHATSAPP_PHONE_NUMBER_ID`     | Registered WhatsApp phone number ID                            |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID                                   |
| `STORAGE_PROVIDER`             | `supabase` or `cloudinary`                                     |
| `SUPABASE_URL`                 | Supabase project URL (if using Supabase)                       |
| `SUPABASE_ANON_KEY`            | Supabase anon key (if using Supabase)                          |
| `CLOUDINARY_CLOUD_NAME`        | Cloudinary cloud name (if using Cloudinary)                    |
| `CLOUDINARY_API_KEY`           | Cloudinary API key (if using Cloudinary)                       |
| `CLOUDINARY_API_SECRET`        | Cloudinary API secret (if using Cloudinary)                    |
| `RESEND_API_KEY`               | Resend transactional email API key                             |
| `EMAIL_FROM_ADDRESS`           | Verified sender address                                        |
| `NEXT_PUBLIC_APP_URL`          | Public app URL (used in client-side code)                      |
| `NEXT_PUBLIC_APP_NAME`         | Display name shown in UI and emails                            |
| `SEED_SUPER_ADMIN_EMAIL`       | Initial super-admin email used by seed script                  |
| `SEED_SUPER_ADMIN_PASSWORD`    | Initial super-admin password used by seed script               |

---

## Running the Development Server

```bash
pnpm dev
```

The app will be available at http://localhost:3000.

---

## Database Migrations

Run database migrations against the active `DATABASE_URL` in `.env.local`:

```bash
# Apply pending migrations and regenerate the Prisma client
pnpm prisma migrate dev
```

To inspect the current migration state without applying changes:

```bash
pnpm prisma migrate status
```

---

## Seeding the Database

Populate the database with initial plans, a default SuperAdmin user, and optionally a sample tenant:

```bash
pnpm prisma db seed
```

> **Note:** Migrations must be applied before running the seed script.

The seed command is idempotent: running it multiple times will not create duplicate records.

### What gets seeded

| Data                 | Condition                          |
|----------------------|------------------------------------|
| Subscription Plans   | Always (Basic POS, Pro POS + WhatsApp) |
| Super Admin User     | Always                             |
| Sample Tenant        | Only when `SEED_SAMPLE_TENANT=true` |

### Environment variables

| Variable                     | Purpose                                              |
|------------------------------|------------------------------------------------------|
| `SEED_SUPER_ADMIN_EMAIL`     | Super Admin email (default: `superadmin@velvetpos.dev`) |
| `SEED_SUPER_ADMIN_PASSWORD`  | Super Admin password (default: `changeme123!`)       |
| `SEED_SAMPLE_TENANT`         | Set to `"true"` to seed "Dilani Boutique" tenant     |
| `SEED_OWNER_EMAIL`           | Owner email for the sample tenant                    |
| `SEED_OWNER_PASSWORD`        | Owner password for the sample tenant                 |

### Seeding with sample tenant

```bash
# Ensure these are set in .env.local:
# SEED_SAMPLE_TENANT="true"
# SEED_OWNER_EMAIL="owner@dilani.dev"
# SEED_OWNER_PASSWORD="ownerpass123!"

pnpm prisma db seed
```

Expected output:
```
Plan already exists, updated fields: Basic POS
Plan already exists, updated fields: Pro POS + WhatsApp
Super Admin account already exists. Skipping creation.
Created sample tenant: Dilani Boutique
Created OWNER user: owner@dilani.dev
Created ACTIVE subscription for Dilani Boutique on Pro POS + WhatsApp plan.
```
Change these values before any staging or production deployment.

Recommended first-run workflow:
1. Configure `DATABASE_URL` in `.env.local`.
2. Run `pnpm prisma migrate dev`.
3. Run `pnpm prisma db seed`.
4. Run `pnpm dev` and sign in with the seeded super-admin account.

---

## Type Checking and Linting

```bash
# TypeScript type check (no emit)
pnpm exec tsc --noEmit

# ESLint (zero-warning policy)
pnpm lint

# Auto-fix ESLint issues
pnpm lint:fix

# Prettier format check
pnpm format:check

# Auto-format all source files
pnpm format
```

---

## Tests

> Test infrastructure will be added as the project matures. This section will document how to run unit, integration, and end-to-end test suites.

---

## Project Structure

```
velvetpos/
+-- prisma/               # Prisma schema, migrations, and seed script
|   +-- schema.prisma
|   +-- prisma.config.ts  # Prisma 7 config file (loads DATABASE_URL)
|   +-- seed.ts
+-- public/
|   +-- fonts/            # Self-hosted WOFF2 fonts
+-- src/
|   +-- app/              # Next.js App Router pages and layouts
|   |   +-- (auth)/       # Authentication routes (login, forgot-password)
|   |   +-- (store)/      # Tenant store routes (POS, inventory, CRM)
|   |   +-- (superadmin)/ # SuperAdmin console routes
|   +-- components/
|   |   +-- shared/       # App-wide shared components (providers, navigation)
|   |   +-- ui/           # ShadCN-generated primitive components
|   +-- lib/              # Utility modules (fonts, Prisma client, helpers)
|   +-- server/           # Server-only logic (actions, services, repositories)
|   +-- stores/           # Zustand client state stores
|   +-- types/            # Shared TypeScript type definitions
+-- .env.example          # Environment variable template
+-- README.md
```

---

## Contributing

This project follows conventional commits. All commits are validated by a Husky pre-commit hook running ESLint and Prettier via lint-staged. Ensure `pnpm lint` and `pnpm format:check` pass before opening a pull request.
