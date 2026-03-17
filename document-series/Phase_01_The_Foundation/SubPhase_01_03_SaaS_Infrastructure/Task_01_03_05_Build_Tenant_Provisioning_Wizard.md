# Task 01.03.05 — Build Tenant Provisioning Wizard

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** High
- **Dependencies:** Task_01_03_03 (Tenant Management Page complete), Task_01_03_06 (Plan seed data available)

## Objective

Build the multi-step tenant provisioning wizard that guides the Super Admin through creating a new tenant — collecting store details, choosing a subscription plan, reviewing the summary, and then creating the Tenant, Owner User, and Subscription records in a single atomic operation.

## Instructions

### Step 1: Choose the Wizard Container Pattern

The provisioning wizard is triggered by the "New Tenant" button on the tenant list page. Implement it as a full-page route at src/app/(superadmin)/tenants/new/page.tsx rather than a Dialog or Sheet, because the three steps contain moderately complex forms that benefit from the full horizontal width of the content area. The page has its own back navigation link pointing to /superadmin/tenants so the Super Admin can cancel at any point. The wizard content is a Client Component since step progression requires client-side state.

### Step 2: Define the Wizard State Shape

Create the wizard as a Client Component at src/components/superadmin/TenantProvisioningWizard.tsx. The component manages a currentStep integer (1, 2, or 3) and a formData object that accumulates values across steps. The formData shape contains all fields from all three steps. The step progression is linear: Step 1 must be completed and validated before Step 2 becomes accessible, and Step 2 must be completed before the Review step appears. Navigating backwards pre-fills the forms with previously entered values.

### Step 3: Build the Step Indicator

At the top of the wizard, render a horizontal step indicator showing three numbered circles labelled "Store Details", "Plan Selection", and "Review & Confirm". Completed steps show a filled espresso circle with a checkmark. The current step shows a filled terracotta circle. Future steps show an unfilled mist circle. Connect the circles with horizontal lines that fill to espresso as steps are completed.

### Step 4: Build Step One — Store Details

Step 1 collects six fields managed by React Hook Form with a Zod validation schema. The fields are: Store Name (text input, minimum 2 characters, maximum 80 characters); Subdomain Slug (text input, lowercase letters, digits, and hyphens only, minimum 3 characters, maximum 30 characters — include a real-time uniqueness check that fires a debounced GET request to /api/superadmin/tenants/check-slug?slug=[value] and displays a green checkmark if available or a red error indicator if already taken); Store Owner Email (email type input validated as a valid email address); Initial Owner Password (password input, minimum 8 characters, with a visible-toggle button); Timezone (a ShadCN Select defaulting to "Asia/Colombo" with common timezone options listed); and Currency (a ShadCN Select defaulting to "LKR" with common currency options). The slug input must automatically transform any uppercase entered characters to lowercase and replace spaces with hyphens as the user types. A "Next Step" button at the bottom triggers React Hook Form validation — only if all fields pass does the wizard advance to Step 2.

### Step 5: Build Step Two — Plan Selection

Step 2 presents the available subscription plans as a set of radio-group selection cards. Fetch the available plans from the database via a GET request to /api/superadmin/plans when the wizard mounts. Each plan card has a linen background, a sand border, and displays the plan name in espresso bold text, the price in terracotta text (formatted as "Rs. X,XXX/month"), and the feature list as small bullet points. When a card is selected its border changes to espresso and a selection checkmark appears in the top-right corner. At least one plan must be selected before the "Next Step" button advances to Step 3. Create the API route at src/app/api/superadmin/plans/route.ts as a protected GET handler that returns all plans where isActive is true, ordered by sortOrder ascending.

### Step 6: Build Step Three — Review and Confirm

Step 3 displays a read-only summary of all data entered across the previous steps. Use a two-column definition-list layout showing each field label and its value. Group the summary into two sections: "Store Information" showing all Step 1 values (displaying the password as a masked placeholder rather than the actual value) and "Subscription Plan" showing the selected plan name, price, and feature list. At the bottom, provide two buttons: a "Back" button that returns to Step 2, and a "Create Tenant" button styled as a primary espresso button. The Create Tenant button must display a loading spinner while the API call is in flight and must be disabled to prevent double-submission.

### Step 7: Create the Provisioning API Endpoint

Create a POST Route Handler at src/app/api/superadmin/tenants/route.ts. This endpoint receives the full provisioning payload in the request body. Before executing any database operations, validate the body using a Zod schema on the server side — never trust the client-side validation alone. The endpoint then calls createTenant from tenant.service.ts, which performs the entire provisioning sequence inside a Prisma transaction: creating the Tenant record with status ACTIVE, creating the Owner User with the hashed password and role OWNER linked to the new tenant, and creating a Subscription record with status TRIALING, the selected planId, and currentPeriodStart set to the current date with currentPeriodEnd set 30 days ahead. The endpoint returns the newly created tenant's ID in the JSON response on success, or a descriptive error message on failure.

### Step 8: Handle Success

When the provisioning API returns a successful response, the wizard performs three actions in sequence: it displays a ShadCN toast notification with the message "Tenant created successfully", it writes a brief success screen replacing the step content showing the new tenant's name and a "View Tenant" link, and it programmatically navigates the Super Admin to the new tenant's detail page at /superadmin/tenants/[newTenantId] after a short delay of 1.5 seconds so the toast is visible before navigation.

### Step 9: Create the Slug Availability API Route

Create a GET Route Handler at src/app/api/superadmin/tenants/check-slug/route.ts. This endpoint accepts a slug query parameter and queries the database to check if any non-deleted Tenant record already has that slug value. It returns a JSON response with a single boolean field available — true if the slug is unused, false if it is already taken. Protect this route with a SUPER_ADMIN session check.

## Expected Output

- src/app/(superadmin)/tenants/new/page.tsx hosts the wizard as a full-page route
- src/components/superadmin/TenantProvisioningWizard.tsx is the wizard Client Component
- Step 1 collects all store details with inline slug availability checking
- Step 2 presents plan selection cards fetched from the database
- Step 3 displays a full read-only summary before submission
- The provisioning API creates Tenant, User, and Subscription atomically in a transaction
- On success the Super Admin is redirected to the new tenant's detail page

## Validation

- [ ] The wizard page is accessible at /superadmin/tenants/new
- [ ] The step indicator renders and updates correctly as steps are completed
- [ ] Step 1 validates all fields before advancing
- [ ] The slug input rejects uppercase letters and automatically converts them to lowercase
- [ ] The slug uniqueness check fires and shows the correct indicator within one second of typing
- [ ] Step 2 loads plan cards from the database and requires a selection before advancing
- [ ] Step 3 shows all data without a password value visible
- [ ] Clicking "Create Tenant" with valid data creates a Tenant, User, and Subscription in the database
- [ ] A success toast appears and navigation to the new tenant's detail page occurs
- [ ] Submitting with a duplicate slug returns an error that is displayed in the form
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

The Initial Owner Password is used to set the OWNER user's hashed credential in the database. It must be hashed using bcrypt with a minimum of 12 salt rounds in the createTenant service function — never store or log the plain-text password anywhere in the system. The wizard should also instruct the Super Admin in the Step 3 summary to communicate this password to the store owner securely, as the system currently does not send an automated welcome email (that is an enhancement for Phase 5).
