# Task 05.02.10 — Build WhatsApp Payment Reminders

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.10 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Medium |
| Depends On | 05.02.06, SubPhase 03.02 (Meta Cloud API WhatsApp utility) |
| Primary Files | src/app/api/cron/payment-reminders/route.ts |
| Roles Involved | System (Vercel Cron — no human actor) |
| Env Vars | CRON_SECRET, META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID |
| Schedule | Daily at 9:00 AM UTC — "0 9 * * *" |

## Objective

Implement a daily cron job that sends automated WhatsApp payment reminders to tenant Owners at three points in the payment lifecycle: three days before the invoice due date, on the due date, and daily during the grace period while the invoice remains unpaid. Record every send attempt as a PaymentReminder record, and prevent duplicate reminders for the same invoice on the same calendar day.

## Instructions

### Step 1: Register the Cron in Configuration Files

Open next.config.ts and add a second entry to the crons array with path "/api/cron/payment-reminders" and schedule "0 9 * * *". Update vercel.json to include the same entry in its crons array. This cron fires at 9:00 AM UTC each morning, after the midnight check-subscriptions cron has already processed any status transitions.

### Step 2: Create the Route File and Authenticate

Create src/app/api/cron/payment-reminders/route.ts. Export an async GET function. Perform the same timing-safe CRON_SECRET Bearer token validation as established in Task 05.02.06: extract the token from the Authorization header, compare using timingSafeEqual with Buffer representations, catch TypeErrors for length mismatch, and return 401 immediately on failure.

Import the WhatsApp send utility from src/lib/integrations/whatsapp.ts (established in SubPhase 03.02). Import date-fns functions: startOfDay, endOfDay, addDays, format.

### Step 3: Initialise the Run Context

Set runAt = new Date() and runDateStart = startOfDay(runAt) and runDateEnd = endOfDay(runAt) for use across all three query windows. Initialise three counters: threeDayRemindersSent = 0, dueDateRemindersSent = 0, overdueRemindersSent = 0, failureCount = 0. All four are returned in the summary response.

### Step 4: Send Three-Day-Before Reminders

Define targetDate = startOfDay(addDays(runAt, 3)) and targetDateEnd = endOfDay(addDays(runAt, 3)).

Query Invoice records with: status equal to PENDING, dueDate between targetDate and targetDateEnd. Include tenant (with owner user) and subscription relations.

For each result: check for an existing PaymentReminder where invoiceId matches and type is THREE_DAY_REMINDER. If one already exists (possible if the cron ran twice on the same day), skip — do not send a duplicate. Invoke the WhatsApp send utility with the Owner's phone number normalised to international format (see Step 7). Message: "Dear [ownerFirstName], your VelvetPOS subscription payment of LKR [amount formatted with commas] is due on [format(invoice.dueDate, 'dd/MM/yyyy')]. Please pay at: [billingPageUrl]."

Wrap the WhatsApp send in a try-catch. On success: create a PaymentReminder record with type THREE_DAY_REMINDER, channel WHATSAPP, sentAt now, status SENT. Increment threeDayRemindersSent. On failure: create the PaymentReminder record with status FAILED. Increment failureCount. Log the error.

### Step 5: Send Due-Date Reminders

Query Invoice records with: status equal to PENDING, dueDate between runDateStart and runDateEnd. Include tenant (with owner user) and subscription relations.

For each result: check for an existing PaymentReminder where invoiceId matches and type is DUE_DATE_REMINDER and sentAt is between today's startOfDay and endOfDay. Skip if found. Message: "Dear [ownerFirstName], your VelvetPOS subscription payment of LKR [amount] is due today. Please pay now to avoid service interruption: [billingPageUrl]."

Apply the same try-catch pattern. Create PaymentReminder records with type DUE_DATE_REMINDER. Increment dueDateRemindersSent on success.

### Step 6: Send Overdue Reminders

Query Invoice records with: status equal to PENDING, dueDate less than runDateStart (i.e., past-due), and the linked Subscription.status equal to PAST_DUE. Include tenant (with owner user), subscription, and existing PaymentReminder records (filter to OVERDUE_REMINDER type).

For each result: check whether an OVERDUE_REMINDER PaymentReminder already exists where sentAt is between today's startOfDay and endOfDay. Skip if found — limit to one overdue reminder per invoice per calendar day. Message: "Dear [ownerFirstName], your VelvetPOS subscription payment of LKR [amount] is overdue. Your access will be suspended if payment is not received soon. Pay now: [billingPageUrl]. Reply STOP to opt out of reminders."

Create PaymentReminder records with type OVERDUE_REMINDER. Increment overdueRemindersSent on success.

### Step 7: Normalise Phone Numbers for Meta Cloud API

Before calling the WhatsApp utility, normalise every phone number to the format expected by the Meta Cloud API (digits only, no spaces, no dashes, no parentheses, with country code). For Sri Lankan mobile numbers:
- If the number starts with "0" (e.g., 0771234567), replace the leading 0 with "94" to produce "94771234567".
- If the number starts with "+94", strip the "+" to produce "94771234567".
- If the number already starts with "94" and is 11 digits long, use as-is.
- If the number cannot be resolved to a plausible Sri Lankan mobile number (does not match /^947\d{8}$/), skip the WhatsApp send and create a PaymentReminder with status FAILED and a structured note in a log entry indicating the invalid phone format.

### Step 8: Construct the Billing Page URL

Generate the billing page URL for each tenant by constructing: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/" + tenant.slug + "/billing". If subdomain-based routing is in use (established in SubPhase 05.01), construct: "https://" + tenant.slug + "." + process.env.NEXT_PUBLIC_BASE_DOMAIN + "/dashboard/billing". Use whichever URL strategy the project has standardised.

### Step 9: Return the Summary Response

After all three reminder passes complete, return NextResponse.json with status 200 and a body: { runAt: runAt.toISOString(), threeDayRemindersSent, dueDateRemindersSent, overdueRemindersSent, failureCount }. Wrap the entire handler body in a top-level try-catch so that any unexpected error still returns a 200 with an error field rather than a 500 that would trigger PayHere-style retry confusion on the Vercel cron infrastructure.

## Expected Output

- GET /api/cron/payment-reminders — timing-safe authenticated daily cron route
- Three-day reminders sent for invoices due in three days (first send only)
- Due-date reminders sent for invoices due today (first send only)
- Overdue reminders sent daily (once per calendar day) for PAST_DUE invoices
- PaymentReminder records for every attempt with type, channel, sentAt, and status
- Phone number normalisation for Sri Lankan mobile format
- Summary JSON response with per-type counts

## Validation

- [ ] GET without Authorization header returns 401
- [ ] GET with correct CRON_SECRET returns 200
- [ ] A THREE_DAY_REMINDER is created for an invoice with dueDate exactly 3 days from today
- [ ] A second run on the same day does not create a duplicate THREE_DAY_REMINDER for the same invoice
- [ ] A DUE_DATE_REMINDER is created for an invoice whose dueDate is today
- [ ] An OVERDUE_REMINDER is created for a PAST_DUE invoice where dueDate is yesterday
- [ ] A second run of the overdue pass on the same day does not duplicate the OVERDUE_REMINDER
- [ ] A phone number "0771234567" is normalised to "94771234567" before the API call
- [ ] A malformed phone number creates a FAILED PaymentReminder and does not crash the cron
- [ ] Summary response counts match the actual number of PaymentReminder records created in the database

## Notes

- The WhatsApp Cloud API utility from SubPhase 03.02 should handle authentication (META_WHATSAPP_ACCESS_TOKEN) and message construction. Reuse it directly. If it requires a phoneNumberId parameter, pass META_WHATSAPP_PHONE_NUMBER_ID from the environment in the call.
- The "Reply STOP to opt out" text in the overdue reminder is a best-practice WhatsApp messaging courtesy. Implement opt-out handling in a future SubPhase if needed — for Phase 05 scope, the note is informational only.
- If a tenant has multiple PENDING invoices (unusual, but possible if previous months are unpaid), each invoice generates an independent set of reminders. The cron processes all qualifying invoices regardless of whether they are from the same tenant.
