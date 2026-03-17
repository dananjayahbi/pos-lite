# Task 05.03.03 — Build System Status Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.03 |
| Task Name | Build System Status Page |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 2–3 hours |
| Assignee Role | Lead Developer |
| Dependencies | Prisma database connectivity, src/middleware.ts public route exemptions |
| Output Files | src/app/(public)/status/page.tsx, src/app/api/health/route.ts, updated src/middleware.ts |

## Objective

Build a publicly accessible system status page at /status that communicates the operational state of VelvetPOS infrastructure to operators, tenants, and end users without requiring authentication. Implement a companion GET /api/health endpoint that performs a live database connectivity check and returns structured latency data. The status page auto-refreshes every 30 seconds using TanStack Query's built-in refetch interval, giving visitors real-time assurance that the platform is functioning correctly.

## Instructions

**Step 1: Create the Health Check Endpoint**

Create src/app/api/health/route.ts as a GET Route Handler. This route must carry no authentication middleware guard. At the start of the handler, record the current Unix timestamp in milliseconds using Date.now() and store it in a startTime variable. Perform a minimal database round-trip by calling prisma.$queryRaw with the raw SQL expression SELECT 1 wrapped in the Prisma raw template tag. Compute the latency by subtracting startTime from a new Date.now() call immediately after the query resolves. Return a Response.json object with HTTP 200 containing three fields: status set to the string "ok", latency set to the computed millisecond integer, and timestamp set to new Date().toISOString(). Wrap the entire Prisma call in a try/catch block. In the catch branch, return Response.json with HTTP 503 containing status set to the string "error" and message set to "Database unavailable". Do not forward the raw error object or stack trace to the client — this would expose internal service details.

**Step 2: Define the Four Component Status Data Sources**

The status page monitors four components, each evaluated differently:

- API: determined by calling GET /api/health from the client. The component is Operational if the response status is 200 and the parsed body contains status: "ok". It is Degraded if the response arrives but the status is not "ok". It is Down if the fetch throws or returns a non-2xx status.
- Database: derived from the same /api/health response payload. Map latency to status thresholds: under 150 milliseconds is Operational, 150 to 500 milliseconds is Degraded, over 500 milliseconds or any error condition is Down.
- WhatsApp API: not a live check. This is a third-party provider (Meta/Twilio) whose availability cannot be verified from within VelvetPOS. Hardcode this component as status External with descriptive subtext reading "Provided by a third-party. Monitor at status.twilio.com." Render with a neutral grey badge so it does not alarm users.
- Authentication: evaluated by fetching GET /api/auth/session from the client using a short timeout. If the fetch resolves with a 2xx response within 500 milliseconds, the component is Operational. Otherwise Degraded.

**Step 3: Build the Page Layout and Component**

Create the directory src/app/(public)/ if it does not already exist, then create status/page.tsx inside it. This page must live outside the (dashboard) route group so it renders without the dashboard sidebar and navigation chrome. Apply a full-width layout with a pearl (#F1EDE6) background.

At the top of the page, render the VelvetPOS brand header: the text "Velvet" in Playfair Display at 32px weight 600 in espresso (#3A2D28), followed by "POS" in Inter regular, then the subtitle "System Status" in Inter medium mist (#D1C7BD). Keep the header left-aligned.

Below the header, render the overall status banner. This is a full-width rounded card. When all four components are Operational, the card uses a terracotta (#A48374) background with white text reading "All Systems Operational" in Playfair Display 24px, and a green checkmark SVG icon. When any component is Degraded, the card uses an amber-100 background with espresso text reading "Partial Outage Detected". When any component is Down, the card uses a red-100 background with text "Service Disruption Detected". Include the last-refreshed timestamp as a muted caption in Inter 12px below the status text.

Below the banner, render a 2-column grid on desktop (grid-cols-2) and a single column on mobile (grid-cols-1). Each cell is a ShadCN Card component containing the component name in espresso Inter 16px medium, a status badge, and for the API and Database components, the latency in milliseconds displayed in JetBrains Mono with a muted label. Define the status badge colours as: Operational — terracotta background with white text; Degraded — sand (#CBAD8D) background with espresso text; Down — destructive red background with white text; External — mist (#D1C7BD) background with espresso text.

At the bottom of the page, add a footer section in linen (#EBE3DB) with Inter 12px muted text: "VelvetPOS status updates every 30 seconds. For urgent support, contact support@velvetpos.com."

**Step 4: Implement Live Refresh with TanStack Query**

In the status page component, set up two TanStack Query useQuery calls. The first queries GET /api/health with a queryKey of ["health"] and a refetchInterval of 30000. The second queries GET /api/auth/session with a queryKey of ["auth-session-status"] and a refetchInterval of 30000. Derive the component-level statuses from the query data and error states as described in Step 2. Add a small visual indicator next to the "last checked" timestamp: a 6px rounded dot with the Tailwind class animate-ping in terracotta colour when the query is successfully refreshing, switching to a mist colour when in a loading or error state. This dot signals to users that the page is actively polling without needing a manual refresh.

**Step 5: Exempt the Route in Middleware**

Open src/middleware.ts and locate the logic that determines whether a route requires authentication. Add /status and /api/health to the public routes list — this may be a matcher array, a hardcoded paths array, or a regex pattern depending on the existing middleware implementation. Verify the exemption is correct by opening the /status URL in a browser that is not logged into VelvetPOS and confirming no redirect to the login page occurs.

## Expected Output

- src/app/(public)/status/page.tsx — Full-width public status page with four component cards and 30-second auto-refresh
- src/app/api/health/route.ts — Unauthenticated health check returning status, latency, and timestamp
- src/middleware.ts — /status and /api/health added to authenticated route exclusions

## Validation

- [ ] GET /api/health returns HTTP 200 with { status: "ok", latency: N, timestamp: "..." } when Prisma is connected
- [ ] GET /api/health returns HTTP 503 with { status: "error" } when the database is unreachable (test by stopping the local Postgres instance)
- [ ] Navigating to /status in an incognito browser with no active session loads the page without a login redirect
- [ ] The overall status banner text and colour updates correctly when any component card is in Degraded state
- [ ] Database latency badge correctly shows terracotta for under 150ms, sand for 150–500ms, and red for over 500ms
- [ ] WhatsApp API component always shows the grey External badge regardless of query results
- [ ] TanStack Query refetch interval causes the last-checked timestamp to update every 30 seconds without a full page reload
- [ ] VelvetPOS typography (Playfair Display heading, Inter UI text, JetBrains Mono for latency value) is correctly applied

## Notes

- Adding /api/health to the Vercel deployment health check configuration (under Vercel project settings → Deployment Protection) allows Vercel to mark a deployment as unhealthy if the endpoint returns 503 during the initial post-deploy probe. This is a recommended follow-up configuration step.
- The WhatsApp API hardcode is intentional. Adding a live third-party liveness check from within the backend introduces a server-side request to an external host on every page load — this is unnecessary overhead and a potential SSRF surface. The static "Third-party" label is the correct approach.
