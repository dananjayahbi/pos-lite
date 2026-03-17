# Task 05.03.01 — Configure Sentry Error Monitoring

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.01 |
| Task Name | Configure Sentry Error Monitoring |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 2–3 hours |
| Assignee Role | Lead Developer |
| Dependencies | None |
| Output Files | sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, src/lib/sentry/context.ts, src/app/api/test-error/route.ts |

## Objective

Integrate Sentry error monitoring into VelvetPOS so that all runtime exceptions, unhandled promise rejections, and performance traces are captured and attributed to the correct tenant. Configure the SDK across all three Next.js runtimes — browser, Node.js server, and Vercel Edge Runtime — and establish a standard pattern for attaching tenantId, tenantSlug, userId, and userEmail to every captured event. Ensure source maps are uploaded automatically during Vercel production builds so that stack traces in the Sentry dashboard resolve to original TypeScript source lines rather than minified output.

## Instructions

**Step 1: Install the Sentry SDK**

In the project root, run pnpm add @sentry/nextjs. This single package installs the Sentry Next.js SDK along with @sentry/core and @sentry/node as peer dependencies. After installation, verify that @sentry/nextjs appears in the dependencies section of package.json before proceeding to the next step. If the pnpm lockfile shows peer dependency warnings, check that the installed Next.js version is compatible with the Sentry SDK version — @sentry/nextjs v8 supports Next.js 14 and 15.

**Step 2: Run the Sentry Wizard**

Run pnpm exec sentry-wizard@latest -i nextjs from the project root. The interactive wizard will prompt for your Sentry organisation slug, project name, and an authentication token (generate one at sentry.io under Settings → Developer Settings → Internal Integrations). The wizard performs four actions automatically: it creates sentry.client.config.ts for the browser runtime, sentry.server.config.ts for the Node.js server runtime, and sentry.edge.config.ts for Vercel Edge Runtime calls made from src/middleware.ts. It also wraps the existing next.config.ts with the withSentryConfig higher-order function and installs the Sentry webpack plugin for source map upload. Accept the source map upload option when prompted.

**Step 3: Configure DSN, Environment, and Sample Rates**

Open each of the three generated config files and validate the following settings. In all three files, ensure the dsn field reads the value from the NEXT_PUBLIC_SENTRY_DSN environment variable (process.env.NEXT_PUBLIC_SENTRY_DSN). Set the environment field to process.env.NODE_ENV so Sentry separates production events from local development noise. In sentry.client.config.ts, set tracesSampleRate to 0.2 in production (sample 20% of browser transactions) and to 1.0 in development by checking NODE_ENV inline. Also in the client config, set replaysSessionSampleRate to 0.05 (capture session replays for 5% of users) and replaysOnErrorSampleRate to 1.0 (always capture a replay when an error occurs). In sentry.server.config.ts, set tracesSampleRate to 0.5. The edge config can share the server config's sample rate.

**Step 4: Create the Tenant Context Helper Module**

Create the directory src/lib/sentry/ and inside it create context.ts. In this file, import Sentry from @sentry/nextjs. Export an async function setSentryTenantContext that accepts a parameter object with four fields: tenantId (string), tenantSlug (string), userId (string), and userEmail (string). Inside the function, call Sentry.setContext("tenant", { tenantId, tenantSlug }) to tag all subsequent events on this request with the tenant's identity. Also call Sentry.setUser({ id: userId, email: userEmail }) so the Sentry Issues view can filter by affected user. Export a second function clearSentryContext that calls Sentry.setUser(null) and Sentry.setContext("tenant", null). Call clearSentryContext in any cleanup path where the session is destroyed.

**Step 5: Integrate Context into High-Value Service Paths**

In every API route handler that resolves a tenant session — particularly all routes under src/app/api/[tenantSlug]/ — import setSentryTenantContext and invoke it immediately after the session and tenant have been resolved from the database, before any business logic executes. This ensures that any error thrown later in the same request lifecycle carries full tenant context. Specifically prioritise two service files: in src/lib/services/sale.service.ts, call setSentryTenantContext at the beginning of createSale before any Prisma transaction starts. In src/lib/services/return.service.ts, call it at the beginning of initiateReturn. These are the two most critical user-facing transaction paths and must be monitored with full context.

**Step 6: Create the Development-Only Test Error Endpoint**

Create the file src/app/api/test-error/route.ts as a GET handler. At the very start of the handler function, add a guard: if process.env.NODE_ENV is not equal to "development", return a Response.json({ error: "Not found" }, { status: 404 }) immediately. If the environment is development, throw a new Error with the descriptive message "VelvetPOS Sentry test error — triggered deliberately from /api/test-error at " followed by a new Date().toISOString() timestamp appended inline. This confirms that both Sentry capture and source map resolution are working in the development environment without exposing any callable error trigger in production.

**Step 7: Configure Vercel Environment Variables for Source Map Upload**

Navigate to the Vercel project dashboard and open the Environment Variables settings. Add the following variables, scoped to all environments unless otherwise noted: NEXT_PUBLIC_SENTRY_DSN (the full DSN URL beginning with https://, scoped to Production, Preview, and Development), SENTRY_AUTH_TOKEN (the internal integration token from sentry.io, scoped to Production and Preview only — this is used by the webpack plugin during the build step and must not be exposed to the browser), and SENTRY_PROJECT (the Sentry project slug as a string). The SENTRY_AUTH_TOKEN is the single most important variable for source map upload — without it, Vercel builds will succeed but stack traces in Sentry will show minified output instead of TypeScript source lines.

**Step 8: Verify the withSentryConfig Wrapper in next.config.ts**

Open next.config.ts and confirm that the entire nextConfig object is wrapped with withSentryConfig at the export. The wizard typically handles this, but verify it manually. The withSentryConfig second argument should include the org and project fields matching your Sentry organisation and project slugs. The silent field should be set to true in production to suppress verbose build output. The hideSourceMaps field should be true so uploaded source maps are not served as public static assets from the .next/static directory.

**Step 9: Verify End-to-End in Development**

Start the local development server with pnpm dev. Open a browser and navigate to /api/test-error. Switch to the Sentry dashboard, open the Issues section, and verify the test error appears within 30 seconds. Click into the issue and confirm the stack trace resolves to TypeScript file names and line numbers (not minified bundle references). Also confirm that if you call setSentryTenantContext before the error is thrown in your test, the tenant context object appears in the issue's Additional Data section.

## Expected Output

- sentry.client.config.ts — Browser Sentry SDK configuration with DSN from env, replay settings, and environment tag
- sentry.server.config.ts — Node.js server Sentry SDK configuration with DSN and tracesSampleRate
- sentry.edge.config.ts — Edge runtime Sentry SDK configuration for middleware traces
- src/lib/sentry/context.ts — setSentryTenantContext and clearSentryContext helper functions
- src/app/api/test-error/route.ts — Development-only test endpoint that deliberately throws
- next.config.ts — Updated with withSentryConfig wrapping the nextConfig export

## Validation

- [ ] pnpm add @sentry/nextjs completes without peer dependency conflicts or resolution errors
- [ ] All three Sentry config files exist at the project root and correctly reference NEXT_PUBLIC_SENTRY_DSN
- [ ] The NODE_ENV guard on GET /api/test-error returns HTTP 404 when built with NODE_ENV=production
- [ ] The test error appears in the Sentry dashboard Issues view within 30 seconds of triggering in development
- [ ] Captured issues in Sentry display the tenant context fields tenantId and tenantSlug in Additional Data
- [ ] pnpm run build on Vercel logs successful source map upload (no SENTRY_AUTH_TOKEN error)
- [ ] Stack traces in Sentry Issues resolve to TypeScript source file names and line numbers
- [ ] setSentryTenantContext is called before any throwing logic in sale.service.ts and return.service.ts

## Notes

- Keep tracesSampleRate conservative in production (0.2 client, 0.5 server) to manage Sentry quota. For the sale creation and return paths specifically, consider wrapping them in Sentry.startTransaction manually to guarantee those high-value transactions are always traced regardless of the sample rate.
- The Sentry wizard may make significant modifications to next.config.ts. Review the full diff with git diff next.config.ts before committing to confirm no existing configuration block was overwritten.
- NEXT_PUBLIC_SENTRY_DSN is prefixed with NEXT_PUBLIC_ because it is read on the client side (in sentry.client.config.ts). Never prefix SENTRY_AUTH_TOKEN with NEXT_PUBLIC_ — that would expose the auth token to end users.
