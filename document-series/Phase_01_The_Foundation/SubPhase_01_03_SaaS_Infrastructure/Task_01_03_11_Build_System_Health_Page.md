# Task 01.03.11 — Build System Health Page

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Low
- **Dependencies:** Task_01_03_02 (Super Admin layout complete)

## Objective

Build the System Health page at src/app/(superadmin)/system/page.tsx that gives the Super Admin an at-a-glance operational overview of the platform, including a live database connectivity check, the current deployment environment, a recent audit log table, and a placeholder for storage metrics.

## Instructions

### Step 1: Create the Page File

Create the file src/app/(superadmin)/system/page.tsx as an async Server Component. No URL parameters are accepted — all data is resolved live on each page load, making this page always reflect current conditions rather than a cached snapshot. The page heading is an h1 in Playfair Display bold labelled "System Health". Below the heading, render a refreshed-at timestamp showing the current server time so the Super Admin can confirm how fresh the data is.

### Step 2: Implement the Database Health Check

Create a separate async function named checkDatabaseHealth within the page module (or in a small utility file if preferred). This function attempts to execute a trivially fast Prisma query — such as a raw query of SELECT 1, or a call to prisma.$queryRaw with a simple expression — to confirm that the Prisma client can communicate with the PostgreSQL database. Wrap the entire operation in a try/catch block. If the query succeeds, return the object with a connected status of true and a latency value in milliseconds computed by measuring the time before and after the query using Date.now(). If the query throws, catch the error and return an object with connected set to false and an error message derived from the caught exception's message property. This function must never propagate its own exception — a database outage should render an "Unreachable" status card, not crash the page with a 500 error.

### Step 3: Build the Database Health Card

Call checkDatabaseHealth at the top of the page function and store its result. Render a ShadCN Card component titled "Database" with a pearl background. The card body shows two pieces of information: the connection status label ("PostgreSQL") and the status indicator. When connected is true, display a filled circle icon in success green (#2D6A4F) alongside the text "Connected" with the latency in milliseconds appended in a muted smaller text (for example, "Connected — 12ms"). When connected is false, display a filled circle icon in danger red (#9B2226) alongside the text "Unreachable" and the truncated error message below it in a small danger-tinted text. Below the status, show the database provider and region from environment variables DATABASE_PROVIDER (default "PostgreSQL") and DATABASE_REGION (default "Not configured") as simple label-value rows.

### Step 4: Build the Application Status Card

Construct a second ShadCN Card titled "Application". Read the NODE_ENV environment variable to determine the runtime mode. Map the NODE_ENV value to a human-readable label and colour: "development" maps to "Development" in a muted blue text, "test" maps to "Test" in a muted purple text, and "production" maps to "Production" in a success green text. Also read the DEPLOYMENT_ENVIRONMENT variable if present for more granular staging differentiation. Read the Next.js version from the package.json at build time or display it as a static string matching the project's installed version. Display these as label-value pairs: Environment, Deployment Environment (if set), and Framework Version.

### Step 5: Fetch Recent Audit Log Entries

Below the two status cards, add a section with an h2 heading "Recent Activity" in Inter semi-bold. Query the AuditLog model using Prisma findMany, ordered by createdAt descending, limited to 20 records, including the actor relation (the User who performed the action) to get the actor's email address. Map the results to a table with columns: Timestamp (formatted as a localised date-time string), Actor Email, Action, Entity Type, and Entity ID. The Entity ID column shows only the first 8 characters of the UUID to keep the table compact — display the full ID in a tooltip on hover if the ShadCN Tooltip component is available. If no audit log entries exist, display the message "No activity recorded yet." in a centred muted text.

### Step 6: Build the Storage Usage Placeholder Card

Add a third card in the status grid titled "Storage". Inside it, display the label "Media Storage" with a muted description reading "Storage metrics require integration with the configured media storage provider (Supabase Storage or Cloudinary)." Below the description, render a ShadCN Badge component with the label "Coming in Phase 5" using a muted mist background colour. This card should contain no live data — it is a visual placeholder that communicates the planned feature to the Super Admin without implying it is functional.

### Step 7: Arrange the Status Cards in a Grid

Place the three status cards (Database, Application, Storage) in a three-column responsive grid that collapses to a single column on smaller screens (md:grid-cols-3). Below this grid, display the Recent Activity table spanning the full width.

## Expected Output

- src/app/(superadmin)/system/page.tsx renders four sections: status card grid and audit log table
- The database health check runs on every page load and displays Connected or Unreachable based on a live query
- A database outage renders an error card rather than causing a 500 page crash
- The application status card shows the current NODE_ENV and optional DEPLOYMENT_ENVIRONMENT values
- The recent activity table shows the 20 most recent AuditLog entries
- The storage card displays the Phase 5 placeholder badge

## Validation

- [ ] The page is accessible at /superadmin/system without errors
- [ ] The Database card shows "Connected" in success green when the database is reachable
- [ ] The Database card shows "Unreachable" in danger red without crashing the page when the database is unavailable
- [ ] The latency is displayed in milliseconds alongside the Connected status
- [ ] The Application card shows the correct NODE_ENV-derived environment label
- [ ] The AuditLog table displays up to 20 entries ordered from most to least recent
- [ ] The Storage card displays the "Coming in Phase 5" badge
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

The database health check adds a small overhead to every page load of the System Health page. This is acceptable because the page is accessed infrequently by the Super Admin. Never place this health check in the middleware, in any page that regular store users visit, or in any shared layout component — the latency cost would compound significantly at scale. Confine it strictly to this administrative page.
