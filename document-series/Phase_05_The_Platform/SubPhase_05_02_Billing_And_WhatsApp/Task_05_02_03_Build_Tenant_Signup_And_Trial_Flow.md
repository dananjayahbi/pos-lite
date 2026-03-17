# Task 05.02.03 — Build Tenant Signup and Trial Flow

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.03 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Medium |
| Depends On | 05.02.01, 05.02.02 |
| Primary Files | src/lib/billing/subscription.service.ts, src/components/layout/TrialBanner.tsx, src/app/dashboard/[tenantSlug]/layout.tsx |
| Roles Involved | SUPER_ADMIN (tenant creation trigger), OWNER (dashboard view) |

## Objective

Automatically enroll every newly created tenant in a 30-day TRIAL subscription. Expose a persistent countdown banner in the tenant dashboard header that informs Owners of their remaining trial days, with a visual urgency shift from sand to terracotta as expiry approaches.

## Instructions

### Step 1: Create the Billing Subscription Service

Create the file src/lib/billing/subscription.service.ts. This module centralises all subscription lifecycle operations and is importable from server components, API routes, and server actions.

Export the function createTrialSubscription which accepts two arguments: tenantId as a string and planId as a string. The function executes the following inside a single Prisma transaction (prisma.$transaction):
- Verify the plan exists and isActive is true. Throw an error if not.
- Compute trialEndsAt as new Date() plus 30 days (30 * 24 * 60 * 60 * 1000 milliseconds).
- Set currentPeriodStart to the current date and currentPeriodEnd to trialEndsAt.
- Create the Subscription record with status TRIAL, the computed date fields, and the given planId and tenantId.
- Update the Tenant record to set subscriptionStatus to TRIAL.
- Return the created subscription.

The atomicity of this transaction is essential: if the Subscription write succeeds but the Tenant update fails (or vice versa), neither change persists and the caller receives an error it can handle.

Export a second function getSubscriptionForTenant which accepts tenantId as a string and returns the Subscription record with its plan relation included and the three most recent invoices (ordered by createdAt descending). Return null if no subscription exists. This function is used by the dashboard layout, billing page, and trial banner to avoid redundant database calls.

### Step 2: Hook Trial Creation into the Tenant Creation Flow

Locate the Super Admin tenant creation API route or service function established in SubPhase 05.01. After the Tenant record has been created, add a call to createTrialSubscription passing the new tenant's id. 

Crucially, this call should ideally be folded into the same Prisma transaction as the Tenant creation itself. Pass the transaction context (tx) into createTrialSubscription by making the function accept an optional Prisma transaction client as a third argument. This ensures that if subscription creation fails, the entire tenant record is rolled back and the Super Admin receives an actionable error rather than a partially created tenant with no subscription.

If the tenant creation flow in SubPhase 05.01 uses a service function rather than an inline route handler, extend that service function's internal transaction to include the subscription creation. Pass a planId argument to the tenant creation endpoint so that Super Admins can optionally assign a non-default starting plan — default to the STARTER plan's id if none is provided.

### Step 3: Build the Trial Banner Component

Create src/components/layout/TrialBanner.tsx as a server component. It accepts a subscription prop typed as Subscription with its plan relation. The component contains no client-side interactivity and renders nothing (returns null) if subscription.status is not TRIAL.

When status is TRIAL, compute daysRemaining as Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)). Clamp the result to a minimum of zero.

Render a full-width banner with a flex layout: an icon on the left, a text message in the centre, and a "Subscribe Now" button-link on the right. The message text is: "Your free trial ends in [daysRemaining] day[s]. Subscribe now to keep full access."

Apply background and text colours conditionally:
- If daysRemaining is greater than 7: background sand (#CBAD8D), text espresso (#3A2D28).
- If daysRemaining is 7 or fewer but greater than 0: background terracotta (#A48374), text white (#FFFFFF).
- If daysRemaining equals 0 (trial has expired but cron has not yet run): background espresso (#3A2D28), text pearl (#F1EDE6). Replace the day count text with "Your trial has ended. Renew now to restore full access."

The "Subscribe Now" link uses a ShadCN Button with variant="outline" and navigates to /dashboard/[tenantSlug]/billing. Extract the tenantSlug from the subscription's tenant relation (include tenant in the getSubscriptionForTenant query).

### Step 4: Integrate the Trial Banner into the Dashboard Layout

Open src/app/dashboard/[tenantSlug]/layout.tsx. Inside the server component body, call getSubscriptionForTenant with the resolved tenantId. Render the TrialBanner component directly below the top navigation bar and above the main content wrapper, passing the subscription prop. Because TrialBanner is a server component, no additional client boundary is needed and no Suspense wrapper is required for it.

Wrap the TrialBanner render in a conditional: only render it if the subscription is non-null and its status is TRIAL. This eliminates the server component call overhead for tenants with ACTIVE or other statuses.

### Step 5: Handle the CANCELLED and PAST_DUE States in the Layout

While the primary focus of this task is the TRIAL banner, add a secondary informational banner below the TrialBanner position for the PAST_DUE state. Render a terracotta-background banner with text: "Your subscription payment is overdue. Please pay now to avoid suspension." Include the same "Renew Now" link to the billing page. This covers the period between a failed payment and the cron-driven SUSPENDED transition (Task 05.02.06).

## Expected Output

- src/lib/billing/subscription.service.ts with createTrialSubscription (transactional) and getSubscriptionForTenant
- TrialBanner component with three visual states: > 7 days (sand), ≤ 7 days (terracotta), expired (espresso)
- Dashboard layout rendering the appropriate banner based on subscriptionStatus
- New tenants automatically receive a 30-day TRIAL Subscription on creation

## Validation

- [ ] Creating a new tenant via the Super Admin panel creates a Subscription with status TRIAL
- [ ] The Subscription.trialEndsAt is within ±5 seconds of creation time plus 30 days
- [ ] Tenant.subscriptionStatus is set to TRIAL at the same moment the Subscription is created
- [ ] createTrialSubscription rolls back both writes if one fails (test by mocking a Prisma error on the Tenant update)
- [ ] Trial banner renders in the dashboard header for TRIAL tenants
- [ ] Banner background is sand (#CBAD8D) for more than 7 days remaining
- [ ] Banner background is terracotta (#A48374) at exactly 7 days remaining
- [ ] Banner background is espresso (#3A2D28) when daysRemaining is 0
- [ ] Banner is absent for ACTIVE, SUSPENDED, and CANCELLED subscriptions
- [ ] PAST_DUE banner renders for tenants in that state

## Notes

- The planId passed to createTrialSubscription defaults to the STARTER plan. Super Admins manually onboarding enterprise prospects may override this to GROWTH or ENTERPRISE at tenant creation time.
- Trial subscriptions do not require any payment data. The payhereSubscriptionToken field remains null throughout the trial period.
- The trial banner is deliberately a server component to avoid a client-side hydration flicker on the subscription status check. Keeping it server-rendered also ensures the day count reflects the server clock, not the user's local device time.
