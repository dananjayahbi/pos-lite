# Task 01.03.10 — Build Suspension Enforcement UI

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_09 (Tenant Status Middleware implemented)

## Objective

Build the full-screen suspension overlay page at src/app/(store)/suspended/page.tsx displayed when a tenant's status is SUSPENDED, and create the GracePeriodBanner component at src/components/shared/GracePeriodBanner.tsx shown persistently across all store pages when a tenant is in their grace period.

## Instructions

### Step 1: Create the Suspended Page Route

Create the file src/app/(store)/suspended/page.tsx. This page lives inside the (store) route group but must render without the normal store sidebar and navigation chrome. Ensure the (store) layout.tsx is configured to detect when the current route is /suspended and skip rendering the sidebar and nav, replacing them with only the page content. One clean way to implement this is to check the pathname within the layout — if it is /suspended, render only the children without any layout wrapping. Alternatively, move the suspended page outside the (store) route group entirely into src/app/suspended/page.tsx, which is the simpler approach since it bypasses the store layout automatically.

### Step 2: Build the Suspension Overlay Layout

The suspension page is a full-viewport centered column layout with a pearl background. Nothing from the regular store UI — no sidebar, no header, no breadcrumbs — should be visible. Use min-h-screen with flex, flex-col, items-center, and justify-center to position the content vertically and horizontally centred. Apply a maximum width constraint of around 480 pixels to prevent the text from spanning the full screen width on large monitors.

### Step 3: Render the VelvetPOS Brand Element

At the top of the centred column, render the VelvetPOS wordmark in Playfair Display bold at a moderate size, using the espresso colour (#3A2D28). Below the wordmark, add a thin horizontal separator.

### Step 4: Render the Suspension Icon and Heading

Below the wordmark, render a large AlertTriangle icon from lucide-react styled in the danger red colour (#9B2226) at approximately 56 pixels. The icon should have a subtle drop shadow in a muted danger tone to give it visual weight. Below the icon, render an h1 heading in Playfair Display that reads "Your Account Has Been Suspended". Style the heading in the danger colour. Below the heading, add a paragraph in Inter regular that reads: "Access to your VelvetPOS store has been suspended due to an outstanding payment. Please settle your balance to restore access."

### Step 5: Display the Outstanding Invoice Amount

This page is a Server Component, so it can perform a database query. Using the tenantId from the server-side session (retrieved by calling the Auth.js auth() function), query the most recent Invoice record for this tenant where the status is UNPAID or OVERDUE. If such an invoice exists, display a highlighted card (amber warning border, linen background) showing the outstanding amount formatted in LKR, the invoice number, and the billing date. If no invoice is found, skip this card entirely — do not display a zero or placeholder amount.

### Step 6: Add Contact and Payment Instructions

Below the optional invoice card, add a paragraph instructing the store owner to contact VelvetPOS support. Render a "Contact Support" button styled as a primary espresso button that is an anchor link to the support email address stored in an environment variable named SUPPORT_EMAIL (use a mailto: link). Below the button, add a small muted text line reading "Or call us at [support phone from environment variable SUPPORT_PHONE]." These contact details are read from environment variables so they can be changed without redeployment.

### Step 7: Ensure the Suspended Route Bypasses Middleware Tenant Status Checks

Open src/middleware.ts and confirm that the /suspended path is excluded from the tenant status enforcement block. This is critical: if the middleware were to check the tenant status and then redirect to /suspended, and /suspended triggered another check that redirected back to /suspended, the result would be an infinite redirect loop. The /suspended route must always be in the matcher exclusion list.

### Step 8: Create the GracePeriodBanner Component

Create the file src/components/shared/GracePeriodBanner.tsx. This is a Server Component that accepts a visible boolean prop and an optional graceEndsAt Date prop. When visible is true, the banner renders as a sticky top element spanning the full page width. The banner has a warning amber background (#B7791F), white or pearl text, and a medium vertical padding. Its content is a centred flex row containing: a warning icon (Clock or AlertCircle from lucide-react), the text "Your payment is overdue. Your account will be suspended on [graceEndsAt formatted as a readable date].", and a "Resolve Now" button-style link pointing to the tenant's billing contact page or a generic mailto link to the billing support address.

### Step 9: Mount the GracePeriodBanner in the Store Layout

Open the (store) route group's layout.tsx. This is a Server Component where the request headers are accessible. Use the Next.js headers() function from next/headers to read the x-grace-period header from the current request. If the header value equals "true", set a boolean flag to true. Also attempt to read graceEndsAt from the session or from the header (the middleware could optionally inject the date as a second header x-grace-ends-at for the layout to read). Render the GracePeriodBanner component immediately above the main content area, passing the visibility flag and the grace end date as props. When visible is false, the banner renders nothing, so it adds no layout cost for healthy tenants.

## Expected Output

- src/app/suspended/page.tsx (or src/app/(store)/suspended/page.tsx) is a full-screen suspension overlay with no store chrome
- The suspension page shows the brand, the danger icon and heading, the optional outstanding invoice card, and contact instructions
- src/components/shared/GracePeriodBanner.tsx renders a sticky amber warning banner when visible is true
- The GracePeriodBanner is mounted in the store layout and activated by the x-grace-period response header set by middleware
- The /suspended route is excluded from middleware tenant status enforcement checks

## Validation

- [ ] Visiting /suspended while having a valid session shows the full suspension overlay with no sidebar
- [ ] The suspension page correctly displays the outstanding invoice amount when an UNPAID or OVERDUE invoice exists for the tenant
- [ ] The "Contact Support" button generates a mailto link using the SUPPORT_EMAIL environment variable
- [ ] The /suspended path does not trigger a middleware redirect loop
- [ ] The GracePeriodBanner renders correctly with an amber background and the grace period end date
- [ ] The GracePeriodBanner does not render for tenants with ACTIVE status
- [ ] The store layout correctly reads the x-grace-period header and passes it to the banner component
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

Because the suspension page is server-rendered and reads the session to fetch the outstanding invoice, it will only display invoice data to users who remain authenticated. A tenant's user remains authenticated even when suspended — the session is still valid, but the middleware redirects all store routes to /suspended. The session itself is not invalidated on suspension; only access is blocked. This is correct behaviour — the session must remain active so the user can see the suspension page with their invoice details and contact support.
