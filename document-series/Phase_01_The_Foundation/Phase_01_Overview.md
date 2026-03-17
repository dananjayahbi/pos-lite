# Phase 01 — The Foundation

## Metadata

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Phase Number**   | 01                                                                    |
| **Codename**       | The Foundation                                                        |
| **Document Type**  | Layer 1 — Phase Overview                                              |
| **Status**         | Not Started                                                           |
| **Created**        | 2026-03-17                                                            |
| **Last Updated**   | 2026-03-17                                                            |
| **Dependencies**   | None — this is the starting phase                                     |
| **Parent Document**| `00_Project_Overview.md`                                              |

---

## Table of Contents

- [Phase 01 — The Foundation](#phase-01--the-foundation)
  - [Metadata](#metadata)
  - [Table of Contents](#table-of-contents)
  - [1. Phase Goal](#1-phase-goal)
  - [2. Key Deliverables](#2-key-deliverables)
  - [3. Sub-Phase Breakdown](#3-sub-phase-breakdown)
    - [3.1 SubPhase 01.01 — Project Setup \& Configuration](#31-subphase-0101--project-setup--configuration)
    - [3.2 SubPhase 01.02 — Authentication, RBAC \& Session Management](#32-subphase-0102--authentication-rbac--session-management)
    - [3.3 SubPhase 01.03 — SaaS Infrastructure \& Tenant Management](#33-subphase-0103--saas-infrastructure--tenant-management)
  - [4. Technical Foundations](#4-technical-foundations)
    - [4.1 Project Scaffolding](#41-project-scaffolding)
    - [4.2 Database Schema — Phase 1 Models](#42-database-schema--phase-1-models)
    - [4.3 Design System Initialisation](#43-design-system-initialisation)
    - [4.4 Middleware Architecture](#44-middleware-architecture)
  - [5. Phase Constraints \& Rules](#5-phase-constraints--rules)
  - [6. Dependencies Between Sub-Phases](#6-dependencies-between-sub-phases)
  - [7. Exit Criteria](#7-exit-criteria)
  - [8. What Is NOT in This Phase](#8-what-is-not-in-this-phase)

---

## 1. Phase Goal

Phase 01 — The Foundation — establishes the complete technical infrastructure upon which all subsequent phases are built. Nothing operational (no sales, no products, no reports) exists at the end of this phase. What does exist is a production-grade, fully typed, correctly configured application skeleton with working authentication, a functioning database connection with all core models migrated, an applied design system, and a running SaaS tenant management shell.

The goal of this phase is to answer the question: **"Can the system exist?"** — not yet "Can it do anything useful?" By the end of Phase 1, any developer (or AI agent) can clone the repository, follow the setup instructions, run the development server, and see a working login page and Super Admin dashboard shell. The database can be connected, migrated, and seeded, and the design system is visibly applied to all surfaces.

The Foundation phase is the most critical phase in the entire project. Mistakes made here — in TypeScript configuration, Prisma schema design, NextAuth setup, middleware logic, or multi-tenancy enforcement — propagate through every subsequent phase. Every decision made in Phase 1 is a constraint on every future development decision.

---

## 2. Key Deliverables

| Deliverable                              | Description                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Initialised Next.js Project**          | Next.js 15+ App Router project with TypeScript strict mode, pnpm package manager, proper tsconfig.   |
| **Prisma Schema — Phase 1 Models**       | Schema containing `Tenant`, `User`, `Subscription`, `Plan`, `Invoice`, and `AuditLog` models with migrations run. |
| **Tailwind Design System Applied**       | All six VelvetPOS colour tokens, typography scale, and spacing variables defined and active in the codebase. |
| **ShadCN/UI Themed**                     | ShadCN/UI installed and re-skinned to use VelvetPOS colour tokens for `Button`, `Card`, `Input`, `Badge`, `Dialog`, and `Toast`. |
| **ESLint & Prettier Configured**         | ESLint with Next.js + TypeScript strict rules; Prettier; Husky + lint-staged pre-commit hooks all active. |
| **Self-Hosted Fonts Installed**          | Playfair Display, Inter, and JetBrains Mono available via `next/font` from `/public/fonts/`. |
| **NextAuth Credential Login**            | Email + password login flow working. Session established. Incorrect credentials handled gracefully.   |
| **PIN-Based Quick Login**                | 4-digit PIN entry modal working. PIN verified against stored hash. Short-lived session created.       |
| **RBAC Middleware Guard**                | Next.js Middleware enforces route group access based on `role`. Unauthenticated users redirected to `/login`. |
| **Granular Permission System**           | Permission check utility and `usePermissions` hook implemented. Fifty-plus named permissions defined as constants. |
| **Session Version Invalidation**         | Force Logout mechanism implemented via `sessionVersion` field on `User`. Stale sessions rejected.    |
| **Login Audit Trail**                    | All login attempts, successes, and failures written to `AuditLog` with timestamp, IP, and user reference. |
| **Rate Limiting on Auth Endpoints**      | Login and PIN endpoints rate-limited to 10 attempts per IP per 15-minute window.                     |
| **Auto-Logout / Screen Lock**            | Configurable inactivity timer implemented. POS lock screen displays PIN numpad. App state preserved.  |
| **Super Admin Layout Shell**             | Espresso-themed sidebar layout for the `(superadmin)` route group. Accessible only to `SUPER_ADMIN` role. |
| **Tenant Management Page**               | Super Admin can view a list of all tenants, see their status, and navigate to individual tenant detail pages. |
| **Tenant Provisioning Wizard**           | Multi-step form allowing the Super Admin to create a new tenant record with initial settings and subscription plan assignment. |
| **Subscription Plan Records**            | Database seeded with available subscription plans (Basic POS, Pro POS + WhatsApp) with their prices.  |
| **Tenant Status Middleware**             | Middleware evaluates `tenant.status` on each request. Suspended workers see suspension screen. Grace period shows warning banner. |
| **Super Admin Dashboard**                | Overview page showing tenant count, MRR figure (computed from active subscriptions), and recent activity log. |
| **MRR & Billing Panel**                  | Super Admin view showing per-tenant revenue, subscription renewal dates, and overdue accounts.        |
| **System Health Page**                   | Displays database health indicator, recent error log, and resource summary.                           |
| **Environment Variables Template**       | `.env.example` file with all required variables listed with descriptive comments.                     |
| **README**                               | Root `README.md` with prerequisites, setup steps, and development commands.                           |
| **Super Admin Seed Account**             | Database seeder that creates the Super Admin user account and the initial subscription plans.         |
| **Initial Tenant Seed (Optional)**       | Seeder option to create a sample tenant with an `OWNER` account for local development and testing.    |

---

## 3. Sub-Phase Breakdown

### 3.1 SubPhase 01.01 — Project Setup & Configuration

**Folder:** `SubPhase_01_01_Project_Setup/`

This sub-phase establishes the entire technical scaffold of the project from the first `pnpm create next-app` command through to a fully configured, linted, typed, and styled empty application shell. No business logic exists at the end of this sub-phase — only the infrastructure that makes business logic possible.

**What is built:**
- Next.js 15+ project initialised with TypeScript strict mode and App Router
- pnpm configured as package manager
- Prisma ORM installed and connected to a PostgreSQL database
- All Phase 1 Prisma models defined and the first database migration run
- Tailwind CSS 4 installed with VelvetPOS design tokens (colour palette, typography, spacing)
- ShadCN/UI installed and key components re-skinned to match the VelvetPOS theme
- ESLint with Next.js + TypeScript strict configuration
- Prettier with Husky and lint-staged pre-commit hooks
- Application directory structure created and validated against the canonical layout in `00_Project_Overview.md`
- Self-hosted fonts (Playfair Display, Inter, JetBrains Mono) installed via `next/font`
- Global layout shell (`(store)` and `(superadmin)` route groups with layout.tsx files)
- TanStack Query and Zustand installed and providers wired into the root layout
- Initial Prisma seed script scaffolded

**Task count:** 12 tasks

---

### 3.2 SubPhase 01.02 — Authentication, RBAC & Session Management

**Folder:** `SubPhase_01_02_Auth_And_RBAC/`

This sub-phase builds the complete identity and access control system. At the end of this sub-phase, real users can log into the application with their email + password or a PIN, the system enforces role-based access, granular permissions are checked at both the API and UI levels, and all authentication events are audited.

**What is built:**
- `User` and role-related Prisma models created with Bcrypt-hashed password and PIN fields
- NextAuth.js v5 (Auth.js) configured with Credentials provider
- Full login page built using the VelvetPOS design system (espresso palette, Playfair Display heading, warm earth tones)
- PIN-based quick login flow with 4-digit numpad modal
- Next.js Middleware auth guard routing unauthenticated users to /login
- RBAC permission system with 50+ named permission constants and `usePermissions` hook
- Forgot password and password reset flow (email-based)
- Auto-logout / screen lock with configurable inactivity timer
- Session version invalidation mechanism (Force Logout)
- Login and action audit trail writing to `AuditLog`
- Rate limiting on `/api/auth` and `/api/auth/pin` endpoints
- Super Admin seeder script producing the initial platform owner account

**Task count:** 12 tasks

---

### 3.3 SubPhase 01.03 — SaaS Infrastructure & Tenant Management

**Folder:** `SubPhase_01_03_SaaS_Infrastructure/`

This sub-phase builds the SaaS commercial layer. At the end of this sub-phase, the Super Admin can log in, view all tenants, create new tenants, assign subscription plans, and the system automatically enforces tenant status rules (grace period, suspension) across every request.

**What is built:**
- `Tenant`, `Subscription`, `Plan`, and `Invoice` Prisma models fully defined and migrated
- Super Admin layout with espresso-themed sidebar, full-page navigation, and isolated route group
- Tenant list page with status badges, search, filter, and pagination
- Individual tenant detail page showing subscription status, plan, billing history, and admin actions
- Tenant provisioning wizard — multi-step form creating a new `Tenant` record with initial settings and plan assignment
- Subscription plan records seeded (Basic POS, Pro POS + WhatsApp) with pricing
- Tenant status enforcement middleware evaluating `tenant.status` on every store-facing request
- Suspension full-screen overlay for the POS terminal and warning banner for management pages
- Super Admin dashboard with MRR metric, tenant count, recent sign-ups, and upcoming renewals
- MRR and billing panel with per-tenant revenue breakdown
- System health page with database connection status and error log summary
- Initial seed script for development tenant and plans

**Task count:** 12 tasks

---

## 4. Technical Foundations

### 4.1 Project Scaffolding

The project is initialised using `pnpm create next-app` with the following options selected: TypeScript, ESLint, Tailwind CSS, App Router, no `src/` directory alias (the `src/` directory is configured manually to match the canonical structure). The package manager is `pnpm` throughout — no `npm` or `yarn` commands are used anywhere in the project.

The canonical directory structure defined in Section 4 of `00_Project_Overview.md` is the authoritative layout. The `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`, and `src/types/` directories are all created as empty scaffolds during this phase — even those that won't be populated until later phases. This prevents any future task from needing to create top-level directories and ensures the structure is correct from day one.

The `tsconfig.json` must have `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, and path aliases configured for `@/` pointing to `./src/`. The `next.config.ts` file configures image domains for Supabase Storage and Cloudinary.

### 4.2 Database Schema — Phase 1 Models

The following Prisma models are created during Phase 1. These are the only models that exist at the end of Phase 1; all other models (Product, Sale, Customer, etc.) are deferred to subsequent phases.

**Models created in Phase 1:**

| Model           | Sub-Phase | Description                                                                |
| --------------- | --------- | -------------------------------------------------------------------------- |
| `User`          | 01.02     | All staff accounts and the Super Admin account                             |
| `Session`       | 01.02     | NextAuth session storage (if using database sessions adapter)              |
| `VerificationToken` | 01.02 | NextAuth email verification tokens for password reset                     |
| `Tenant`        | 01.03     | SaaS client workspace record                                               |
| `Plan`          | 01.03     | Available subscription plans (Basic, Pro)                                  |
| `Subscription`  | 01.03     | Active subscription linking a Tenant to a Plan                             |
| `Invoice`       | 01.03     | Monthly billing invoice records per tenant                                 |
| `AuditLog`      | 01.02     | Polymorphic audit trail for all sensitive actions                          |

Every model that belongs to a tenant scope must carry a `tenantId` field. This is enforced as a code review rule. The `User` model's `tenantId` is nullable to accommodate the Super Admin account, which exists outside any tenant.

All models use UUID primary keys. All models that represent business entities use soft deletes (`deletedAt DateTime?`). The `AuditLog` model never uses soft deletes — audit entries are permanent.

The first Prisma migration is named `init_phase1_foundation`. All subsequent Phase 1 migrations are named descriptively (e.g., `add_tenant_status_enum`, `add_session_version_to_user`).

### 4.3 Design System Initialisation

The VelvetPOS design system defined in Section 7 of `00_Project_Overview.md` is the authoritative source for all visual decisions. During Phase 1, the design system is applied as CSS custom properties in `tailwind.config.ts` and made available as Tailwind utility classes throughout the application.

The six primary colour tokens (`--color-espresso`, `--color-terracotta`, `--color-sand`, `--color-mist`, `--color-linen`, `--color-pearl`) and the six semantic colour tokens (`--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-text-primary`, `--color-text-muted`) must all be defined as Tailwind `extend.colors` entries.

The three font faces (Playfair Display, Inter, JetBrains Mono) are loaded via `next/font` in the root `layout.tsx` and applied as CSS variables (`--font-display`, `--font-body`, `--font-mono`). These are then referenced in `tailwind.config.ts` to extend the `fontFamily` configuration.

ShadCN/UI is installed using its CLI. The following base components are customised to match the VelvetPOS theme: `Button`, `Card`, `Input`, `Select`, `Textarea`, `Badge`, `Dialog`, `Sheet`, `Table`, `Toast` (via Sonner). Each component's default Tailwind class variants are updated to use the VelvetPOS colour tokens.

### 4.4 Middleware Architecture

The Next.js Middleware file (`src/middleware.ts`) is the single security enforcement point for all HTTP requests. It is responsible for:

1. **Authentication Guard:** Requests to any protected route (all routes except `(auth)` routes and webhook endpoints) must carry a valid NextAuth session. Unauthenticated requests are redirected to `/login`.

2. **Role Enforcement:** The `(superadmin)` route group is only accessible to users whose session contains `role === 'SUPER_ADMIN'`. Any other role attempting to access a superadmin route is redirected to their appropriate home route.

3. **Session Version Check:** The session's `sessionVersion` is compared against the `User.sessionVersion` stored in the database. If the session version is stale (lower than the database value), the session is invalidated and the request is redirected to `/login`. This check must be efficient — it uses a lightweight database read, not a full session refresh.

4. **Tenant Status Check:** For all store-facing routes (the `(store)` route group), the middleware reads the current tenant's status from the `Tenant` record. If `status === 'SUSPENDED'`, the request is intercepted and the suspension overlay page is served. If `status === 'GRACE_PERIOD'`, the request proceeds but a `x-grace-period: true` header is injected into the response for the frontend to consume and display a warning banner.

The Middleware runs on the Edge Runtime and must not import Node.js modules. Database reads within the Middleware must use an Edge-compatible Prisma client or a lightweight fetch to a dedicated internal status endpoint.

---

## 5. Phase Constraints & Rules

The following constraints are specific to this phase. They supplement the global constraints defined in Section 15 of `00_Project_Overview.md`.

1. **No business logic in this phase.** Phase 1 creates the infrastructure. No product, sale, customer, or inventory logic is implemented. Any task that appears to encroach on Phase 2+ scope must be flagged and deferred.

2. **No placeholder UI.** Every page and component built in Phase 1 must use the VelvetPOS design system. No generic grey boxes, no `TODO: style this later` comments. Every surface that exists at the end of Phase 1 must look production-quality.

3. **Prisma schema is the source of truth.** The `prisma/schema.prisma` file defines the authoritative structure of the database. No migration should be run without a corresponding change to the schema file. Every migration should be reviewed before being applied.

4. **NextAuth database adapter.** NextAuth must be configured to use the Prisma adapter with the database as the session storage backend. JWT-only sessions are not used. The `Session` and `VerificationToken` models must exist in the Prisma schema.

5. **No direct database access in Middleware.** The Middleware runs on the Edge Runtime. Database access must be performed via an Edge-compatible client or a lightweight internal API fetch. The trade-off between security and performance must be clearly documented in the Middleware file.

6. **Every secret is an environment variable.** Even in local development. The `.env.local` file is never committed to version control. The `.env.example` file is the documentation of all required secrets.

---

## 6. Dependencies Between Sub-Phases

The three sub-phases of Phase 1 have the following sequential dependency chain:

```
SubPhase 01.01 (Project Setup)
        ↓
SubPhase 01.02 (Auth & RBAC)      ← Cannot begin until 01.01 is fully complete
        ↓
SubPhase 01.03 (SaaS Infrastructure)  ← Cannot begin until 01.02 is fully complete
```

The rationale for this strict sequencing:

- **01.02 depends on 01.01** because the Prisma client, NextAuth configuration, Tailwind, and ShadCN must all be in place before any authentication UI or logic can be built. The `User` model must be in the schema before NextAuth can be configured.

- **01.03 depends on 01.02** because the Super Admin portal is only accessible to authenticated Super Admin users. The authentication and RBAC system must be fully functional before the Tenant Management pages are built. The `Tenant` and `Subscription` models reference `User` (as created_by fields and owner references), so the User models must exist first.

No partial work across sub-phases is permitted. Sub-phase 01.01 must satisfy all its exit criteria before Sub-phase 01.02 begins. Sub-phase 01.02 must satisfy all its exit criteria before Sub-phase 01.03 begins.

---

## 7. Exit Criteria

Phase 1 is considered complete when ALL of the following criteria are satisfied:

- [ ] `pnpm dev` starts the development server at `localhost:3000` with zero console errors and zero TypeScript compilation errors.
- [ ] `pnpm tsc --noEmit` passes with zero errors.
- [ ] `pnpm eslint src/` passes with zero errors and zero warnings.
- [ ] All Prisma migrations run cleanly against a fresh PostgreSQL database with `pnpm prisma migrate deploy`.
- [ ] The login page at `/login` renders correctly with all VelvetPOS design tokens applied (correct colours, typography, and spacing).
- [ ] A valid email + password combination for the seeded Super Admin account successfully logs in and redirects to the Super Admin dashboard.
- [ ] An invalid credential combination shows the appropriate error message and does not create a session.
- [ ] The PIN login flow at `/pin-login` accepts a 4-digit PIN, verifies it, and creates a session.
- [ ] Navigating to any `(store)` or `(superadmin)` route while unauthenticated redirects to `/login`.
- [ ] A logged-in `CASHIER` account attempting to access any `/superadmin` route is redirected to their appropriate home.
- [ ] A `SUPER_ADMIN` account can log in, see the tenant list page, and create a new tenant via the provisioning wizard.
- [ ] The `tenant.status === 'SUSPENDED'` check in Middleware correctly serves the suspension overlay for a suspended tenant.
- [ ] The seeder creates the Super Admin account, the two subscription plans, and can optionally create a sample tenant with an Owner account.
- [ ] Tailwind design tokens are verified — all six primary colours and three font families are available as utility classes.
- [ ] ShadCN `Button` in its primary variant displays the correct espresso background colour with pearl text.
- [ ] All self-hosted fonts load correctly with no layout shift (verified in Chrome DevTools).
- [ ] The `.env.example` file lists every required environment variable with comments.
- [ ] The `README.md` contains accurate setup instructions that a new developer can follow to get the application running from scratch.

---

## 8. What Is NOT in This Phase

The following items are explicitly excluded from Phase 1 and must not be implemented, even partially:

| Excluded Item                        | Deferred To                |
| ------------------------------------ | -------------------------- |
| Product catalogue and variant models | Phase 2 — The Catalog      |
| Stock management logic               | Phase 2 — The Catalog      |
| POS terminal UI                      | Phase 3 — The Terminal     |
| Sale creation API                    | Phase 3 — The Terminal     |
| Returns and exchange workflow        | Phase 3 — The Terminal     |
| Customer CRM                         | Phase 4 — The Operations   |
| Supplier and purchase order models   | Phase 4 — The Operations   |
| Staff commissions                    | Phase 4 — The Operations   |
| Promotions engine                    | Phase 4 — The Operations   |
| Reporting and analytics              | Phase 5 — The Platform     |
| PayHere IPN webhook handling         | Phase 5 — The Platform     |
| WhatsApp e-receipt dispatch          | Phase 5 — The Platform     |
| Automated email sending              | Phase 5 — The Platform     |
| Dashboard real-time metrics          | Phase 5 — The Platform     |
| Sentry error logging integration     | Phase 5 — The Platform     |
