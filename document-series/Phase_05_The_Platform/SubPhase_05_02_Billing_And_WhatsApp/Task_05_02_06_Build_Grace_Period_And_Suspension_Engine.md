# Task 05.02.06 — Build Grace Period and Suspension Engine

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.06 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | 05.02.05 |
| Primary Files | src/app/api/cron/check-subscriptions/route.ts, next.config.ts, vercel.json |
| Roles Involved | System (Vercel Cron — no human actor) |
| Env Vars | CRON_SECRET, RESEND_API_KEY |
| Schedule | Daily at midnight UTC — "0 0 * * *" |

## Objective

Implement a Vercel Cron Job that runs daily at midnight UTC to enforce the complete subscription lifecycle: expire past-due TRIAL subscriptions, enforce a 7-day grace period for PAST_DUE subscriptions, promote PAST_DUE subscriptions beyond the grace period to SUSPENDED, and send suspension notification emails via Resend. All transitions are recorded in the audit log.

## Instructions

### Step 1: Register the Cron Job

Open next.config.ts. Inside the NextConfig object, add a crons array (supported in Next.js 13.5+ for Vercel deployments). Add one entry with path "/api/cron/check-subscriptions" and schedule "0 0 * * *". This registers the cron with Vercel's infrastructure so it fires a GET request to that path every day at 00:00 UTC.

Create or update vercel.json at the project root with a top-level "crons" array containing the same entry. The vercel.json declaration is the authoritative Vercel runtime configuration; the next.config.ts entry enables local testing with the Vercel CLI (vercel dev). Commit both changes.

### Step 2: Create the Cron Route File

Create src/app/api/cron/check-subscriptions/route.ts. Export an async GET function that accepts a NextRequest. Import createHash and timingSafeEqual from the built-in "crypto" module. Import Prisma and the audit log service from SubPhase 01.02. Import the Resend client from src/lib/email/resend.ts.

### Step 3: Validate the CRON_SECRET

As the first operation inside the GET handler, extract the Authorization header from the request. Parse the Bearer token: const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "". Compare the token to CRON_SECRET using a timing-safe equality check to prevent timing-based token enumeration attacks. The comparison must use Buffer representations: timingSafeEqual(Buffer.from(token), Buffer.from(process.env.CRON_SECRET ?? "")). Wrap this in a try-catch because timingSafeEqual throws if the two buffers have different lengths. If the validation fails for any reason, return a 401 JSON response immediately.

### Step 4: Initialise Counters and Timestamp

After authentication, initialise three integer counters: trialsExpired = 0, subscriptionsSuspended = 0, suspensionEmailsSent = 0. Record the run start time as runAt = new Date(). These will be included in the summary response.

### Step 5: Expire Overdue TRIAL Subscriptions

Query all Subscription records where status equals TRIAL and trialEndsAt is less than runAt (i.e., the trial period has ended). Use a Prisma findMany with the tenant relation included (to get the Owner's email for future steps) and the plan relation included.

For each expired trial subscription, execute a Prisma transaction that:
- Updates Subscription.status to PAST_DUE.
- Updates Tenant.subscriptionStatus to PAST_DUE.
- Creates an AuditLog entry with action "TRIAL_EXPIRED", entityType "Subscription", entityId set to the subscription id, and metadata containing tenantId, trialEndsAt, and runAt.

Increment trialsExpired after each successful transition. Log each transition: "Trial expired for tenant [tenantSlug] (subscription [subscriptionId])."

### Step 6: Enforce the Grace Period

Define a constant GRACE_PERIOD_DAYS = 7 at the top of the file (or import it from src/lib/billing/constants.ts if that file is established). This value is the number of days after currentPeriodEnd during which a PAST_DUE tenant retains full access.

Query all Subscription records where status equals PAST_DUE, including the tenant relation (with tenant owner user) and the most recent FAILED or PENDING Invoice (for the amount-due display in the suspension email). Exclude subscriptions that were just transitioned from TRIAL in Step 5 to avoid double-processing in a single run.

For each PAST_DUE subscription, compute daysPastDue using: Math.floor((runAt.getTime() - subscription.currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24)). Apply the following logic:

- If daysPastDue is less than or equal to GRACE_PERIOD_DAYS: log "Tenant [tenantSlug] in grace period: day [daysPastDue] of [GRACE_PERIOD_DAYS]." Skip all further processing for this subscription.
- If daysPastDue is greater than GRACE_PERIOD_DAYS: proceed to Step 7 for this subscription.

### Step 7: Execute the Suspension Transition

For each subscription that is beyond the grace period, execute a Prisma transaction:
- Update Subscription.status to SUSPENDED.
- Update Tenant.subscriptionStatus to SUSPENDED.
- Create an AuditLog entry with action "SUBSCRIPTION_SUSPENDED", entityType "Subscription", entityId set to the subscription id, and metadata containing tenantId, daysPastDue, and runAt.

Add the tenant and its latest invoice to a suspensionList array for email dispatch in Step 8. Increment subscriptionsSuspended after each successful transition.

### Step 8: Send Suspension Notification Emails

Iterate over the suspensionList populated in Step 7. For each entry, send an email via the Resend API using the email client from src/lib/email/resend.ts. Construct the email as follows:

- To: the tenant Owner's email address
- Subject: "Your VelvetPOS subscription has been suspended"
- Text body: "Dear [ownerName], your VelvetPOS subscription for [tenantName] has been suspended due to non-payment. The outstanding balance is LKR [invoiceAmount]. Please log in to renew your subscription and restore access: [billingPageUrl]. If you believe this is an error, contact support at support@velvetpos.com."

Wrap each email send in a try-catch. On success, increment suspensionEmailsSent and log the send. On failure, log the error with tenantId and proceed to the next tenant — email delivery failure must not abort the cron run.

### Step 9: Process Long-Term Suspended Tenants

Query SUSPENDED Subscription records where the Tenant.subscriptionStatus has been SUSPENDED for more than 30 days — approximate this by checking currentPeriodEnd is more than 37 days ago (grace period of 7 + 30 days). For each such tenant, create an AuditLog entry with action "SUBSCRIPTION_OVERDUE_30_DAYS" for Super Admin review. Do not automatically cancel subscriptions — cancellation is a business decision requiring a Super Admin action to preserve the full audit trail and allow for late restorations.

### Step 10: Return the Summary Response

Return a NextResponse.json response with status 200 and a structured summary object: runAt (ISO string), trialsExpired, subscriptionsSuspended, suspensionEmailsSent, and durationMs (Date.now() minus runAt.getTime()). This response is captured by Vercel's cron execution log and is invaluable for debugging scheduled job behaviour without exposing any PII.

## Expected Output

- GET /api/cron/check-subscriptions — timing-safe authenticated cron route
- Expired TRIAL subscriptions transitioned to PAST_DUE with AuditLog entries
- PAST_DUE subscriptions within 7 days of currentPeriodEnd remain untouched
- PAST_DUE subscriptions beyond 7 days from currentPeriodEnd transitioned to SUSPENDED with AuditLog entries
- Suspension notification emails dispatched via Resend
- Summary JSON response with run counts and duration
- Cron declared in both next.config.ts and vercel.json

## Validation

- [ ] GET without Authorization header returns 401
- [ ] GET with incorrect Bearer token returns 401
- [ ] GET with correct CRON_SECRET returns 200 and runs all processing
- [ ] TRIAL subscriptions with trialEndsAt in the past transition to PAST_DUE
- [ ] PAST_DUE subscriptions with daysPastDue equal to 7 remain PAST_DUE (within grace period)
- [ ] PAST_DUE subscriptions with daysPastDue equal to 8 transition to SUSPENDED
- [ ] Tenant.subscriptionStatus is updated in the same transaction as Subscription.status for every transition
- [ ] AuditLog entries exist for each TRIAL_EXPIRED and SUBSCRIPTION_SUSPENDED event
- [ ] Suspension emails are sent for each newly suspended tenant
- [ ] An email send failure does not prevent subsequent tenants from being processed
- [ ] Summary JSON body contains accurate trialsExpired, subscriptionsSuspended, and suspensionEmailsSent counts

## Notes

- The GRACE_PERIOD_DAYS constant should be defined in src/lib/billing/constants.ts rather than inlined in the cron route. This allows the grace period to be adjusted via a single change without a full codebase search.
- The timing-safe comparison on the CRON_SECRET defends against timing-based secret guessing. Always use timingSafeEqual rather than === for secrets even if the secret is long. The try-catch is required because timingSafeEqual throws a TypeError if the two Buffer arguments have different byte lengths.
- Vercel Cron Jobs on the Hobby plan are limited to once daily. The "0 0 * * *" schedule exactly satisfies this constraint. Pro and Enterprise plans support up to every minute.
- Never expose tenant PII (names, emails, amounts) in the cron summary response body, as this response is logged by Vercel infrastructure which may be shared across a team.
