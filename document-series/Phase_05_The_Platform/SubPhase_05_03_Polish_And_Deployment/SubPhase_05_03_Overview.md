# SubPhase 05.03 — Production Deployment and Polish

## Metadata

| Field | Value |
|---|---|
| SubPhase ID | 05.03 |
| SubPhase Name | Production Deployment and Polish |
| Phase | Phase 05 — The Platform |
| Status | Planned |
| Estimated Duration | 5–7 days |
| Dependencies | SubPhase 05.01 (Billing and Subscriptions), SubPhase 05.02 (Analytics and Reporting) |
| Priority | Critical — Final SubPhase |
| Lead Role | Lead Developer |

## Objective

SubPhase 05.03 is the final sub-phase of the entire VelvetPOS project. Its purpose is to harden, polish, and ship the platform to production. This sub-phase moves the project from a feature-complete state to a production-ready, monitored, and maintainable SaaS product. It covers error monitoring via Sentry, a signed outbound webhook system, a public status page, custom subdomain routing, Vercel deployment configuration, UI polish through loading skeletons and empty states, accessibility compliance, React Error Boundaries, a final code quality audit, a comprehensive 90-day demo seeder, and the definitive project handoff document.

## Scope

**In Scope**

- Sentry error monitoring with tenant-aware context and source map upload
- Outbound webhook system with HMAC-SHA256 signing, delivery logging, and management UI
- Public system status page with live connectivity checks
- Custom subdomain routing via Vercel DNS wildcard CNAME configuration
- Vercel production deployment configuration and cron job declarations
- UI loading skeleton components for all data-fetching pages
- Empty state components for all list views and report pages
- Accessibility audit covering ARIA labels, focus management, colour contrast, and form labelling
- React Error Boundary components with Sentry integration
- Final TypeScript strict-mode and ESLint clean pass
- Comprehensive demo seeder generating 1,000+ sales across 90 days
- Final launch checklist and project handoff document

**Out of Scope**

- New feature development beyond what is specified in these twelve tasks
- Native mobile application deployment
- Third-party marketplace or ERP integrations
- Custom white-label theming per tenant beyond the existing design system
- Redis-based caching layer (deferred to a future operations iteration)

## Technical Context

This sub-phase uses the complete VelvetPOS stack: Next.js 15 App Router, TypeScript strict mode, Prisma + PostgreSQL, pnpm only, Tailwind CSS 4, ShadCN/UI, NextAuth.js v5, TanStack Query, Zustand, React Hook Form + Zod, and decimal.js. Three new additions are introduced here: the @sentry/nextjs package for error monitoring, the WebhookEndpoint and WebhookDelivery Prisma models for the outbound webhook system, and a vercel.json file for cron job configuration. All production deployments target Vercel with a wildcard *.velvetpos.com custom domain provisioned via a DNS CNAME record pointing to cname.vercel-dns.com. The demo seeder extends prisma/seed.ts to produce realistic clothing-retail data tailored to Sri Lankan pricing and weekly shopping patterns.

## Task List

| Task ID | Task Name | Complexity | Dependencies |
|---|---|---|---|
| 05.03.01 | Configure Sentry Error Monitoring | Medium | None |
| 05.03.02 | Build Outbound Webhook System | High | Prisma models, sale/return services |
| 05.03.03 | Build System Status Page | Medium | Prisma, /api/health, public middleware |
| 05.03.04 | Configure Custom Subdomain Routing | Medium | Tenant model, src/middleware.ts |
| 05.03.05 | Build Production Deployment Configuration | Medium | All prior tasks complete |
| 05.03.06 | Build UI Loading Skeletons | Medium | TanStack Query integration on all pages |
| 05.03.07 | Build Empty State Components | Medium | All list and report pages |
| 05.03.08 | Perform Accessibility Audit and Fixes | High | All UI components across all phases |
| 05.03.09 | Build Error Boundary Components | Medium | Task 05.03.01 (Sentry) |
| 05.03.10 | Run Final TypeScript and ESLint Audit | Medium | All prior tasks complete |
| 05.03.11 | Build Comprehensive Demo Seeder | High | All Prisma models finalized |
| 05.03.12 | Final Launch Checklist and Handoff | High | All tasks complete |

## Validation Criteria

- [ ] Sentry receives error events tagged with tenantId, tenantSlug, userId, and userEmail in both development and production
- [ ] Webhook dispatch system sends signed POST requests with HMAC-SHA256 headers and logs every attempt to WebhookDelivery
- [ ] Public status page at /status loads without authentication and reflects live database health
- [ ] Custom subdomains (tenant.velvetpos.com) extract the tenant slug and attach it via X-Tenant-Slug header without blocking the request
- [ ] Vercel deployment via pnpm run build completes with zero errors in CI
- [ ] All data-fetching pages show skeleton loaders during the TanStack Query isLoading state
- [ ] All list and report pages render an appropriate empty state component when data length is zero
- [ ] All icon-only buttons carry aria-label props; all form inputs have associated label elements
- [ ] React Error Boundaries wrap all major page sections and display a styled fallback UI on error
- [ ] pnpm tsc --noEmit and pnpm eslint src/ both exit with zero errors
- [ ] Demo seeder creates 1,000+ sale records across 90 days and completes in under 60 seconds
- [ ] Launch checklist is complete and signed off before the production go-live event

## Files Created or Modified

- sentry.client.config.ts — Browser Sentry SDK configuration
- sentry.server.config.ts — Node.js server Sentry SDK configuration
- sentry.edge.config.ts — Edge runtime Sentry SDK configuration
- src/lib/sentry/context.ts — Tenant-aware Sentry context helpers
- src/app/api/test-error/route.ts — Development-only Sentry test endpoint
- prisma/schema.prisma — WebhookEndpoint and WebhookDelivery models added
- prisma/migrations/[timestamp]_add_webhook_models/ — Migration files
- src/lib/webhooks/dispatch.ts — HMAC-signed webhook dispatch service
- src/lib/webhooks/generate-secret.ts — Cryptographic secret generator
- src/app/api/[tenantSlug]/webhooks/endpoints/route.ts — Webhook endpoint management API
- src/app/(dashboard)/[tenantSlug]/settings/webhooks/page.tsx — Webhook management UI
- src/app/(public)/status/page.tsx — Public system status page
- src/app/api/health/route.ts — Unauthenticated health check endpoint
- src/middleware.ts — Updated for subdomain extraction and tenant slug injection
- vercel.json — Cron job declarations
- src/components/skeletons/ — Skeleton component library (TableSkeleton, CardGridSkeleton, ListSkeleton, ChartSkeleton)
- src/components/empty-states/ — Empty state component library
- src/components/ErrorBoundary.tsx — React class-based Error Boundary
- src/components/ErrorBoundaryFallback.tsx — Styled fallback UI
- prisma/seed.ts — Extended with 90-day demo data generation
- next.config.ts — Updated with withSentryConfig wrapper
- document-series/Phase_05_The_Platform/SubPhase_05_03_Polish_And_Deployment/ENV_VARS_CHECKLIST.md
