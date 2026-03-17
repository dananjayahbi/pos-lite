# Task 01.03.03 — Build Tenant Management Page

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_02 (Super Admin layout complete), Task_01_03_07 (tenant.service.ts — may be developed in parallel but must be merged before final integration)

## Objective

Build the paginated tenant list page at src/app/(superadmin)/tenants/page.tsx that displays all tenants across the platform, provides name search and status filtering, and links to individual tenant detail pages, with supporting API routes for server-side data fetching.

## Instructions

### Step 1: Create the Page File

Create the file src/app/(superadmin)/tenants/page.tsx. This file is a React Server Component — do not add the "use client" directive at the top. Server components are the correct choice here because the page receives its filter and pagination parameters from URL search params, fetches data on the server, and passes the rendered HTML to the client without needing browser-side interactivity in the data table itself.

### Step 2: Define the Search Params Interface

The page component receives a searchParams prop from Next.js containing the parsed URL query string as an object. Define the expected shape of this object: a search string for the name filter, a status string for the TenantStatus filter, and a page number string for pagination. All three values are optional — the page must work correctly with no query parameters at all, defaulting to an empty search, no status filter, and page one.

### Step 3: Fetch Tenant Data Server-Side

At the top of the page function body, read the search, status, and page values from searchParams. Pass these values to the getAllTenants function from src/lib/services/tenant.service.ts. This function returns a result object containing the array of tenant records (each including the nested plan name via the subscription relation) and a total count used for pagination. Set a default page size of 20 rows per page.

### Step 4: Build the Page Header

The page header is a flex-row div with space between its left and right sections. The left section contains an h1 element styled in Playfair Display bold font with the espresso text colour, displaying the text "Tenants". The right section contains a button or Link element styled as a primary espresso-background button with pearl text, labelled "New Tenant", and pointing to the tenant provisioning wizard route at /superadmin/tenants/new or triggering the wizard sheet depending on the implementation decision made in Task 01.03.05.

### Step 5: Build Search and Filter Controls as a Client Component

The search input and status filter dropdown must be interactive — they update the URL search params when the user types or selects a value, causing a server-side re-render with the new filters. Because these elements need browser interactivity, extract them into a Client Component at src/components/superadmin/TenantFilters.tsx. This component uses the Next.js useRouter and useSearchParams hooks. The search input is a text field with a placeholder of "Search by store name…" and a debounced onChange handler that updates the search query param. The status filter is a ShadCN Select component offering options for All, Active, Grace Period, Suspended, and Cancelled. When the value changes it updates the status query param. Both controls clear the page query param back to one whenever their values change. Import and render TenantFilters below the page header.

### Step 6: Build the Tenant Data Table

Create the tenant table as a shared DataTable instance or a dedicated table structure beneath the filters. The table columns are: Store Name (the tenant name rendered as a Link to /superadmin/tenants/[tenantId] in espresso text), Slug (plain mono-spaced text), Plan Name (pulled from the tenant's active subscription or "No Plan" if null), Status (a TenantStatusBadge component), Created Date (formatted as a readable date string), and Actions (a View link pointing to the tenant detail page). Create the TenantStatusBadge component at src/components/superadmin/TenantStatusBadge.tsx — it is a small ShadCN Badge element whose colour variant is determined by the tenant status: a success-green variant for ACTIVE, warning-amber for GRACE_PERIOD, danger-red for SUSPENDED, and a muted mist variant for CANCELLED.

### Step 7: Build Server-Side Pagination Controls

Below the table, add a pagination row showing "Showing X–Y of Z tenants" on the left and Previous / Next buttons on the right. The buttons are Link components pointing to the same page URL with the page query parameter incremented or decremented. The Previous button is disabled when on page one, and the Next button is disabled when the current page is the last page based on the total count and page size. Compute totalPages as Math.ceil(total / pageSize) and compare against the current page number.

### Step 8: Create the Tenant List API Route

Create the file src/app/api/superadmin/tenants/route.ts as a GET Route Handler. This route accepts the search, status, and page query parameters, calls getAllTenants from tenant.service.ts, and returns the result as a JSON response. The route must validate that the caller has an active SUPER_ADMIN session by checking the Auth.js session before executing the query — return a 403 response if the session is absent or the role does not match. This API route is not used by the server component page (which calls the service directly), but will be consumed by future client-side operations such as the provisioning wizard's tenant-count display.

### Step 9: Wrap Data Loading With Suspense

Wrap the table section in a React Suspense boundary with an appropriate loading fallback. The fallback should be a skeleton component showing placeholder rows in the same dimensions as the actual table. This enables Next.js to stream the page header and filters to the client immediately while the database query resolves, improving perceived performance.

## Expected Output

- src/app/(superadmin)/tenants/page.tsx is a Server Component that fetches and renders the paginated tenant list
- src/components/superadmin/TenantFilters.tsx is a Client Component handling search and status filter interactions
- src/components/superadmin/TenantStatusBadge.tsx renders colour-coded badges for all four tenant statuses
- src/app/api/superadmin/tenants/route.ts is a protected GET Route Handler returning paginated tenant data
- The page renders all tenants with correct data in the table
- Search and status filtering correctly narrow the displayed results
- Pagination controls navigate between pages of results

## Validation

- [ ] The page renders without errors when visited at /superadmin/tenants
- [ ] All tenant rows display store name, slug, plan name, status badge, and created date
- [ ] The TenantStatusBadge renders the correct colour for each status value
- [ ] Typing in the search field filters the tenant list to matching names
- [ ] Selecting a status filter option shows only tenants with that status
- [ ] Pagination controls appear when total tenants exceed the page size
- [ ] Each store name is a clickable link that navigates to the tenant detail page
- [ ] The "New Tenant" button is visible and navigates to or opens the provisioning wizard
- [ ] The API route at GET /api/superadmin/tenants returns 403 for unauthenticated requests
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

Passing filter state through URL search params rather than client-side React state is the preferred pattern in Next.js App Router because it makes filtered views shareable via URL, compatible with browser back and forward navigation, and resilient to full page refreshes. The page size of 20 is hardcoded for now — a per-page selector can be added in a later phase when the tenant count grows large enough to make it necessary.
