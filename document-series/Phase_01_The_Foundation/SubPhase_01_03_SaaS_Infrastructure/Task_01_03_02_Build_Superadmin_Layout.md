# Task 01.03.02 — Build Superadmin Layout

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_01 (Tenant and Subscription models created and migrated)

## Objective

Complete the Super Admin layout at src/app/(superadmin)/layout.tsx by building the full-viewport espresso fixed sidebar, grouped navigation structure, user session footer, and pearl main content area that frames every Super Admin-facing page, with a server-side role guard as a defence-in-depth access control measure.

## Instructions

### Step 1: Confirm the Route Group and Existing Placeholder

Open the src/app/(superadmin)/ directory and confirm it was created during Task 01.01.06. If a layout.tsx placeholder file exists, open it and clear its content — you will rewrite it from scratch. The parenthesised segment in the directory name instructs Next.js to exclude the group name from all URL paths, so pages inside this folder are served at /dashboard, /superadmin/tenants, /superadmin/billing, and /superadmin/system without any "(superadmin)" prefix appearing in the browser address bar.

### Step 2: Make the Layout an Async Server Component

Declare the layout function as an async function. This is required because it must call the Auth.js auth() helper, which is an asynchronous operation that resolves the server-side session before any rendering begins. Import the auth function from src/lib/auth.ts. At the very top of the function body, call auth() and store its result. If the result is null — meaning the user is unauthenticated — call the Next.js redirect function with the target path of /login. If the session exists but session.user.role is not equal to the string "SUPER_ADMIN", redirect to /dashboard. This double-check is a defence-in-depth measure; the primary enforcement gate is already in src/middleware.ts. Having it here ensures that any misconfiguration in the middleware cannot result in an unauthorised user viewing the Super Admin portal.

### Step 3: Define the Root Container

The layout's return value should begin with a single root div element configured as a full-height flex row. Apply the Tailwind classes h-screen, overflow-hidden, and flex to this element. The overflow-hidden on the root container ensures neither the sidebar nor the page as a whole overflows the viewport — scrolling is confined to the main content area only.

### Step 4: Build the Fixed Sidebar Container

Inside the root div, add the first child as the sidebar div. Apply flex-shrink-0 and a fixed width of 240 pixels — in Tailwind this is the w-60 class. Give it the full height of the container using h-full. Set the background colour to espresso using the design token class configured in the Tailwind theme, which resolves to the hex value #3A2D28. Inside the sidebar, arrange content in a column using flex, flex-col, and h-full so the navigation content sits at the top and the footer section sits at the bottom with justify-between applied to the column.

### Step 5: Build the Wordmark Section

At the top of the sidebar column, add a padding wrapper with 24 pixels of horizontal and vertical padding. Inside it, render the VelvetPOS wordmark as a paragraph or span element styled with the Playfair Display font class, a bold weight, approximately 20 pixels of size, and pearl text colour (#F1EDE6 resolved via the design token). Directly below the wordmark, add a horizontal rule or a border-bottom styled div using the mist colour (#D1C7BD) at reduced opacity to serve as a visual separator between the wordmark and the navigation.

### Step 6: Extract Navigation Into a Client Component

The active link highlight logic requires the usePathname hook from next/navigation, which is only available in Client Components. Create a new file at src/components/superadmin/SuperAdminNav.tsx and mark it with the "use client" directive at the top. This component will receive no props and will internally call usePathname to determine the current route. Inside it, define the three navigation groups as structured data: Overview containing Dashboard linking to /dashboard; Platform containing Tenants linking to /superadmin/tenants and Billing linking to /superadmin/billing; and System containing Health linking to /superadmin/system. For each navigation link, use the Next.js Link component. Apply conditional classes based on whether the current pathname matches the link's href: when active, apply a left border in sand (#CBAD8D) and a linen (#EBE3DB) background fill at low opacity with pearl text; when inactive, apply transparent background with a muted pearl text colour that transitions to terracotta (#A48374) on hover. Each group label is uppercase, small text, in a muted sand-adjacent tone.

### Step 7: Import the Navigation Into the Server Layout

Back in layout.tsx, import SuperAdminNav from src/components/superadmin/SuperAdminNav and place it inside the sidebar column below the wordmark separator. This is the standard Next.js App Router pattern: server components compose client components by importing them, while the client component handles all interactivity in isolation.

### Step 8: Build the Sidebar Footer

At the bottom of the sidebar column, add a footer div separated from the navigation by a top border in mist colour. Apply padding of 16 pixels. Inside, display the logged-in Super Admin's email address — retrieved from session.user.email — as a small element in a muted pearl tone. Below the email, render a logout form that invokes the Auth.js signOut server action. The form contains a single submit button labelled "Log Out" styled as a minimal text button with a slightly red-tinted colour on hover. Pass callbackUrl: "/login" to the signOut function so the user is returned to the login page after their session is terminated.

### Step 9: Build the Main Content Area

The second child of the root flex container is the main element. Give it flex-1 so it fills all remaining horizontal space after the sidebar, overflow-y-auto to enable vertical scrolling only within this area, and a pearl background (#F1EDE6 via design token). Apply p-6 (24 pixels) for uniform interior padding. Inside this element, render the children prop so all nested page content flows through here.

### Step 10: Add the Desktop-Only Notice

Immediately above the children output, add a div with the Tailwind class md:hidden so it is only visible on screens smaller than the medium breakpoint. Style this div as a warning banner using the warning colour (#B7791F) for background or border. Display the message: "The VelvetPOS Super Admin portal is designed for desktop use. Please switch to a desktop or laptop computer." This notice is non-functional — Super Admin operations are intentionally not supported on mobile viewports.

## Expected Output

- src/app/(superadmin)/layout.tsx is a complete async Server Component with session-based role guard
- src/components/superadmin/SuperAdminNav.tsx is a complete Client Component with active link detection
- Viewing any Super Admin route while logged in as SUPER_ADMIN displays the espresso sidebar and pearl content area
- Active navigation items show sand left border and linen background highlight
- Inactive navigation items show terracotta text on hover
- The sidebar footer displays the Super Admin's email and a functional logout button
- Non-SUPER_ADMIN users are redirected before the layout renders

## Validation

- [ ] src/app/(superadmin)/layout.tsx exists as an async Server Component
- [ ] src/components/superadmin/SuperAdminNav.tsx exists as a Client Component
- [ ] Navigating to /superadmin/dashboard while authenticated as SUPER_ADMIN shows the full sidebar layout
- [ ] Navigating to /superadmin/dashboard while authenticated as a non-super-admin produces a redirect to /dashboard
- [ ] The VelvetPOS wordmark is rendered in Playfair Display font in the sidebar
- [ ] Each navigation link navigates correctly to its defined route
- [ ] The active navigation item displays the sand left border and linen fill
- [ ] Clicking the logout button ends the session and redirects to /login
- [ ] The main content area has pearl background with 24-pixel padding
- [ ] pnpm tsc --noEmit passes with no errors related to these files

## Notes

Keeping the server layout and the client navigation component separated is essential for performance. The layout.tsx file runs once per request on the server, performing the session lookup and passing the rendered HTML tree to the client. Only the SuperAdminNav component is hydrated interactively on the client, minimising the JavaScript shipped for this frame. Any additional interactive sidebar widgets — such as a notification badge or a collapsible section — should follow the same pattern of being isolated Client Components imported into the server layout.
