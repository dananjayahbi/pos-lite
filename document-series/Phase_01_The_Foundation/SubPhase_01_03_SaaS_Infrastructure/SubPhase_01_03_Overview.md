# SubPhase 01.03 — SaaS Infrastructure & Tenant Management

## Metadata

- **Phase:** 01 — The Foundation
- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Status:** Pending
- **Dependencies:** SubPhase_01_01_Project_Setup (complete), SubPhase_01_02_Auth_And_RBAC (complete)

## Objective

This sub-phase constructs the complete SaaS commercial layer that underpins all VelvetPOS operations. It establishes the data models and service infrastructure that allow the Super Admin to create tenants, assign subscription plans, and manage the full lifecycle state of every store on the platform. Without this foundation, the product features built in Phases 2 through 4 have no commercial container within which to operate.

The goal is entirely administrative and infrastructural — no store-facing product features are built here. Instead, this sub-phase produces the institutional scaffolding: tenant records, plan models, subscription tracking, billing overview, and middleware-level access enforcement. By the end of this sub-phase the Super Admin can onboard a new clothing-store tenant, assign a subscription plan, and the platform will automatically enforce tenant access rights on every incoming request by inspecting and acting on each tenant's current status.

## Scope

### In Scope

- Tenant, Plan, Subscription, and Invoice Prisma models with their corresponding database migration
- Super Admin layout with the espresso sidebar and full navigation structure
- Tenant list page with name search, status filter dropdown, and server-side pagination
- Individual tenant detail page showing subscription information, store settings, and administrative action buttons
- Tenant provisioning wizard — a multi-step form covering store details, plan selection, and a final review step
- Subscription plan seeding for the Basic POS and Pro POS + WhatsApp plans
- Tenant status middleware enforcement: suspension redirect and grace period response header
- Super Admin dashboard with MRR metric card, active tenant count, grace period count, and upcoming renewals
- MRR and billing panel with per-tenant revenue breakdown table
- System Health page showing database connection status and a recent audit log entries table
- The tenant.service.ts service layer implementing all tenant CRUD and status management functions
- Super Admin API routes covering all tenant management and billing operations
- Initial seed data for subscription plans and the sample development tenant
- Store settings JSON schema documented in Technical Context

### Out of Scope

- PayHere IPN webhook handling and automated payment processing (Phase 5)
- Automated invoice generation and PDF file creation (Phase 5)
- WhatsApp payment reminders and dunning campaign automation (Phase 5)
- Automated grace period progression and suspension cron jobs (Phase 5)
- Store staff onboarding and team management within an individual tenant (Phase 4)
- Real-time live dashboard metrics and telemetry streaming (Phase 5)

## Technical Context

### Architecture Overview

This sub-phase introduces a second distinct user persona alongside the store-level users from SubPhase 01.02. The Super Admin persona operates in the (superadmin) Next.js route group, carrying its own layout, its own API routes, and its own role checks. Store-level users operate inside the (store) route group and are always scoped to exactly one tenant. The Super Admin has cross-tenant visibility and is never scoped to any single store.

All Super Admin pages are server components that call tenant.service.ts functions directly. Store-level middleware performs tenant status lookups via a lightweight internal API endpoint because the Edge Runtime where middleware executes cannot invoke Prisma directly.

### Data Model Relationships

The four new models form a strict hierarchy rooted at Tenant. Each Tenant owns one or more Users, maintains one or more Subscriptions over time (one active at any moment), and accumulates Invoices that record individual billing events. A Subscription references a Plan to capture its pricing tier and feature set at the time of subscription creation.

| Model        | Primary Key | Key Relations                                           |
|--------------|-------------|--------------------------------------------------------|
| Tenant       | cuid String | Has many Users, Subscriptions, and Invoices            |
| Plan         | cuid String | Referenced by many Subscriptions                       |
| Subscription | cuid String | Belongs to one Tenant and one Plan; has many Invoices  |
| Invoice      | cuid String | Belongs to one Tenant and one Subscription             |

### Tenant Status Lifecycle

Tenant status is a finite state machine. All transitions must be recorded in the AuditLog with the acting user's ID. The Super Admin may force any transition at any time.

| From State   | To State     | Trigger                                        |
|--------------|--------------|------------------------------------------------|
| ACTIVE       | GRACE_PERIOD | Payment failure detected (manual or IPN)       |
| GRACE_PERIOD | SUSPENDED    | Grace period expiry (manual override or cron)  |
| GRACE_PERIOD | ACTIVE       | Successful payment received                    |
| SUSPENDED    | ACTIVE       | Manual reactivation by Super Admin             |
| Any State    | CANCELLED    | Explicit cancellation request from the tenant  |

Visual colour mapping: ACTIVE uses success green (#2D6A4F), GRACE_PERIOD uses warning amber (#B7791F), SUSPENDED uses danger red (#9B2226), and CANCELLED uses the mist neutral (#D1C7BD).

### Middleware Enforcement Architecture

Next.js Middleware runs on the Edge Runtime, which does not support the Node.js APIs that Prisma requires. Tenant status enforcement must therefore be implemented as a two-part system: the middleware reads the tenant slug from the hostname or the session, makes an internal fetch to the Route Handler at /api/internal/tenant-status, and acts on the returned status. The Route Handler runs in the Node.js runtime with full Prisma access and returns only the tenant's id and status to keep the payload minimal and the lookup fast.

### Super Admin Layout Design Tokens

The sidebar uses the espresso colour (#3A2D28) as its background with pearl (#F1EDE6) text. Navigation group labels use a muted mist-adjacent tone. Active navigation items display a left border in sand (#CBAD8D) and a linen (#EBE3DB) fill. Hover states apply terracotta (#A48374) to icon and text. The main content area uses pearl as its background with 24 pixels of uniform padding.

### Store Settings JSON Schema

The Tenant model's settings field is a JSONB column in PostgreSQL. The documented keys are: currency (ISO 4217 three-letter code, default "LKR"), timezone (IANA timezone string, default "Asia/Colombo"), vatRate (numeric decimal representing a percentage, default 18), ssclRate (numeric decimal for the SSCL surcharge, default 2.5), and receiptFooter (plain text shown at the bottom of printed receipts, default empty string).

## Task List

| Task ID       | Task Name                               | Est. Complexity | Dependencies                        |
|---------------|-----------------------------------------|-----------------|-------------------------------------|
| Task_01_03_01 | Create Tenant And Subscription Models   | High            | SubPhase 01.01 and 01.02 complete   |
| Task_01_03_02 | Build Superadmin Layout                 | Medium          | Task_01_03_01                       |
| Task_01_03_03 | Build Tenant Management Page            | Medium          | Task_01_03_02                       |
| Task_01_03_04 | Build Tenant Detail Page                | Medium          | Task_01_03_03                       |
| Task_01_03_05 | Build Tenant Provisioning Wizard        | High            | Task_01_03_03                       |
| Task_01_03_06 | Create Subscription Plan Models And Seed| Low             | Task_01_03_01                       |
| Task_01_03_07 | Build Tenant Service Layer              | Medium          | Task_01_03_01                       |
| Task_01_03_08 | Build Superadmin Dashboard              | Medium          | Task_01_03_02, Task_01_03_07        |
| Task_01_03_09 | Implement Tenant Status Middleware      | High            | Task_01_03_01                       |
| Task_01_03_10 | Build Suspension Enforcement UI         | Medium          | Task_01_03_09                       |
| Task_01_03_11 | Build System Health Page                | Low             | Task_01_03_02                       |
| Task_01_03_12 | Seed Initial Tenant And Plans           | Low             | Task_01_03_06                       |

## Validation Criteria

- [ ] pnpm tsc --noEmit passes with zero errors across the entire project
- [ ] pnpm prisma migrate dev runs cleanly against a freshly created PostgreSQL database
- [ ] A SUPER_ADMIN user can log in and is served the Super Admin layout with the espresso sidebar visible
- [ ] The tenant list page renders all tenant records with colour-coded status badges
- [ ] Entering text in the search field on the tenant list page filters rows to matching store names only
- [ ] The tenant detail page displays the subscription plan name, current status badge, and the tenant creation date
- [ ] Completing the provisioning wizard creates a new Tenant record with all required fields correctly populated
- [ ] Sending a request to a (store) route while the tenant status is SUSPENDED produces a redirect to /suspended
- [ ] Sending a request to a (store) route while the tenant status is GRACE_PERIOD adds the x-grace-period: true header to the response
- [ ] The Super Admin dashboard displays an MRR figure derived from the priceMonthly sum of all plans tied to ACTIVE subscriptions
- [ ] The System Health page renders the database connection status card without throwing a runtime error
- [ ] Running pnpm prisma db seed creates exactly two Plan records and one sample development Tenant record

## Files Created / Modified

- prisma/schema.prisma — Modified: Tenant, Plan, Subscription, and Invoice models added; User model updated with Tenant relation
- prisma/migrations/ — New timestamped migration for add_tenant_models
- src/lib/services/tenant.service.ts — Created
- src/app/(superadmin)/layout.tsx — Completed from the placeholder shell created in SubPhase 01.01
- src/app/(superadmin)/dashboard/page.tsx — Created
- src/app/(superadmin)/tenants/page.tsx — Created
- src/app/(superadmin)/tenants/[tenantId]/page.tsx — Created
- src/app/(superadmin)/billing/page.tsx — Created
- src/app/(superadmin)/system/page.tsx — Created
- src/app/api/superadmin/tenants/route.ts — Created
- src/app/api/superadmin/tenants/[id]/route.ts — Created
- src/app/api/superadmin/tenants/[id]/suspend/route.ts — Created
- src/app/api/superadmin/billing/route.ts — Created
- src/app/api/internal/tenant-status/route.ts — Created
- src/components/superadmin/ — New directory with SuperAdminNav, TenantStatusBadge, MetricCard, and TenantTable components
- src/middleware.ts — Modified: tenant status enforcement checks appended to existing auth logic
- prisma/seed.ts — Modified: plan records and development tenant seeding added
