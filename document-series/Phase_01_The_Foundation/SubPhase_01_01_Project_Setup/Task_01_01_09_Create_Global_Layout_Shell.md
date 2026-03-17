# Task 01.01.09 — Create Global Layout Shell

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Medium |
| Dependencies | Task_01_01_04, Task_01_01_08 |

## Objective

Create the root layout and all route-group layout shells for (store), (superadmin), and (auth) that establish the foundational page structure, apply VelvetPOS design tokens as default backgrounds, and finalise the global CSS file with all CSS custom property declarations.

## Instructions

### Step 1: Finalise the Global CSS File

Open src/app/globals.css. By this point it should contain the three Tailwind directives and the :root block from Task 01.01.03. Reorganise and finalise the file so its sections appear in the following order: first, the three Tailwind directives (@tailwind base, @tailwind components, @tailwind utilities); second, the :root block declaring all twelve --color-* CSS custom properties with their hex values and the three --font-* custom properties (which will be populated dynamically by next/font at render time — leave their values as empty strings in the static CSS, since next/font injects the actual values via the class names applied to the html element); third, a global body rule setting background-color to var(--color-pearl), color to var(--color-text-primary), and font-family to var(--font-body, system-ui, sans-serif); fourth, a universal box model rule applying box-sizing: border-box to all elements using the * selector. This finalised globals.css is the CSS baseline that all VelvetPOS components build upon — it should not be modified further during Phase 01.

### Step 2: Create the Root Layout

Open the existing src/app/layout.tsx, which was initially scaffolded by the Next.js CLI. Import the displayFont, bodyFont, and monoFont configurations from "@/lib/fonts". Import globals.css. Define and export a Metadata object at the module level with title set to "VelvetPOS" and description set to "Point of Sale system for modern clothing retail". Define the RootLayout component accepting a children prop typed as React.ReactNode. Inside the component, return an html element with the "lang" attribute set to "en". The html element's className should be a string combining the .variable property from each of the three font objects concatenated with spaces, plus the Tailwind "antialiased" utility class for smooth font rendering. Inside the html element, render a body element that renders the children prop directly without additional wrappers at this stage — the QueryProvider wrapper will be added in Task 01.01.10.

### Step 3: Create the Store Route Group Layout

Create the file src/app/(store)/layout.tsx. This layout wraps every page within the store-facing area of VelvetPOS: the POS terminal, inventory management, reports dashboard, and customer management pages. At this stage, the layout is a minimal structural shell. Define and export a StoreLayout component that accepts a children prop typed as React.ReactNode. The component should return a single div element with className values that apply the min-h-screen utility (full viewport height), the flex utility (flexbox container for the sidebar-plus-content two-column layout that will be built in a later sub-phase), and the bg-linen token for the warm background. Inside the div, render the children prop directly. Add a comment in the file noting: "Shell placeholder — the AppSidebar and main content area will be integrated in SubPhase 02.xx when the navigation components are built."

### Step 4: Create the Super Admin Route Group Layout

Create the file src/app/(superadmin)/layout.tsx. This layout wraps all pages in the platform administrator section used by the VelvetPOS operations team to manage merchant stores, platform users, and billing. Define and export a SuperAdminLayout component accepting children typed as React.ReactNode. Return a div with the min-h-screen and flex utilities and a bg-espresso class to establish the dark warm background characteristic of the super admin interface. Render children inside the div. Add a comment noting: "Shell placeholder — the full SuperAdmin sidebar layout is implemented in Phase 03."

### Step 5: Create the Auth Route Group Layout

Create the file src/app/(auth)/layout.tsx. This layout wraps the login page, two-factor authentication page, and password reset page. Auth pages are centered, isolated views with no navigation chrome. Define and export an AuthLayout component accepting children typed as React.ReactNode. Return a div with the classes min-h-screen, bg-linen, flex, items-center, and justify-center. Inside this outer div, render a second inner div with a max-w-md class and w-full to constrain the auth form width and ensure it is centered horizontally on wider screens. Render children inside the inner div.

### Step 6: Create Placeholder Dashboard Pages

For each route group, create a minimal placeholder page.tsx to prevent 404 errors and confirm that route group layouts are being applied correctly during development. In src/app/(store)/dashboard/, create a page.tsx file that exports a default React component returning a main element with a heading containing the text "Store Dashboard — In Development". In src/app/(superadmin)/dashboard/, create a page.tsx file returning a heading with "SuperAdmin Dashboard — In Development". These are temporary placeholder pages that will be fully replaced in their respective sub-phases.

### Step 7: Verify the Layout Application

Run "pnpm dev". Navigate to http://localhost:3000/dashboard and confirm the store dashboard placeholder page loads. Use Chrome DevTools to inspect the computed background-color of the outermost div rendered by the store layout — it should be the linen colour (#EBE3DB). Inspect the html element and confirm all three font CSS classes are applied to it. Open the Console tab and confirm there are no React hydration warning messages, which would indicate a server-client render mismatch that needs to be resolved before proceeding.

## Expected Output

- src/app/globals.css is finalised with the :root custom property block, body base styles, and box-sizing reset in the correct section order
- src/app/layout.tsx applies font variables, the "en" language attribute, and "antialiased" to the html element
- src/app/(store)/layout.tsx is a flex shell div with bg-linen
- src/app/(superadmin)/layout.tsx is a flex shell div with bg-espresso
- src/app/(auth)/layout.tsx is a centered-form container with bg-linen
- Placeholder dashboard pages exist in (store)/dashboard/ and (superadmin)/dashboard/
- No hydration warnings appear in the browser console

## Validation

- [ ] "pnpm dev" starts without compilation errors
- [ ] Chrome DevTools confirms the store layout renders bg-linen (#EBE3DB)
- [ ] The html element carries all three font variable class names
- [ ] No React hydration warnings appear in the browser console
- [ ] "pnpm tsc --noEmit" passes after all layout files are created
- [ ] A 404 does not occur when navigating to /dashboard

## Notes

The children prop in all layout components must be typed as React.ReactNode rather than React.ReactElement or JSX.Element. The Next.js App Router may pass async server components, context providers, or other complex structures as children, and React.ReactNode is the only type broad enough to accept all of these correctly. Using a narrower type causes TypeScript compilation errors that are difficult to diagnose. This typing convention applies to every layout and wrapper component in VelvetPOS.
