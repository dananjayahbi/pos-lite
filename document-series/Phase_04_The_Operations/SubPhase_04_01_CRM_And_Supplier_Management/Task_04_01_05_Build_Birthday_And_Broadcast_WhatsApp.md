# Task 04.01.05 — Build Birthday and Broadcast WhatsApp

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.05 |
| Task Name | Build Birthday and Broadcast WhatsApp |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Prerequisites | 04.01.01 (models), `src/lib/whatsapp.ts` from SubPhase 03.02 |
| Output | Birthday cron endpoint, broadcast API endpoint, broadcast builder page |

---

## Objective

Implement two WhatsApp-based marketing automation features. The first is an automated birthday greeting endpoint designed to be triggered by an external cron scheduler on a daily basis, querying customers whose birthday matches today's date and sending each a personalised greeting via Meta Cloud API. The second is a manual broadcast builder available in the dashboard — staff compose a message, choose a recipient filter, preview the count, and send a one-time campaign to all matching customers.

---

## Context

Both features share the Meta Cloud API text message sender in `src/lib/whatsapp.ts`. The birthday cron endpoint is a standard Next.js Route Handler secured by a bearer token rather than NextAuth session because it is called by an external scheduler (such as a Vercel Cron or a third-party cron service) without a browser session. The broadcast feature is session-authenticated. Sends are synchronous in Phase 04 and limited to 200 recipients per call to stay within acceptable API response times.

---

## Instructions

### Step 1: Add Required Environment Variables

Document the following environment variables in `.env.example` (and configure them in the actual `.env.local`):

- `CRON_SECRET` — a strong random string (at least 32 characters) used to authenticate the birthday cron endpoint. This value must be kept out of source control.
- `WHATSAPP_PHONE_ID` — the Meta Cloud API phone number ID (already present from SubPhase 03.02, confirm it is still in the env file).
- `WHATSAPP_ACCESS_TOKEN` — the Meta Cloud API bearer token (already present, confirm).

### Step 2: Build the Birthday Cron Endpoint

Create `src/app/api/cron/birthday-greetings/route.ts` with a single `GET` handler. At the top of the handler, validate the `Authorization` header: read `req.headers.get('authorization')` and confirm it equals `Bearer ${process.env.CRON_SECRET}`. If the header is missing or incorrect, return HTTP 401 immediately with a JSON body `{ error: 'Unauthorized' }`.

Extract today's month and day using a helper that respects the correct Sri Lanka timezone (Asia/Colombo, UTC+5:30). Use JavaScript's `Intl.DateTimeFormat` with `timeZone: 'Asia/Colombo'` to get the current local month and day rather than relying on UTC values which would be offset and could cause incorrect birthday matching around midnight.

Query the database for all customers where `isActive` is true, `deletedAt` is null, and the birthday month and day match today's local values. In Prisma with PostgreSQL, use a raw query or Prisma's `$queryRaw` to extract the month and day from the `birthday` column using `EXTRACT(MONTH FROM birthday)` and `EXTRACT(DAY FROM birthday)`. Filter by the matching values. Include the customer's `tenantId` and the associated `Tenant.name` and `Tenant.settings` for the personalised message.

For each matching customer, compose the greeting message. If `Tenant.settings.birthdayMessage` is set (a JSON settings field), use that template; otherwise use the default: "Happy Birthday [name]! Thank you for being a valued customer at [storeName]. We hope to see you soon!" Replace the `[name]` placeholder with the customer's first name (first word of `customer.name`) and `[storeName]` with the tenant's display name.

Call the WhatsApp send function from `src/lib/whatsapp.ts` with the customer's `phone` as the recipient. Wrap each send in a try-catch. After each attempt, write a `BirthdayGreetingLog` record via `prisma.birthdayGreetingLog.create` with `status` set to `"SENT"` or `"FAILED"` and `errorMessage` populated on failure.

Return HTTP 200 with a JSON summary: `{ processed: N, sent: N, failed: N }`.

### Step 3: Add Tenant Settings Support for Birthday Message

If the `Tenant` model does not already have a `settings` Json field, add a note in the task documentation that this field should be present (it may have been added in an earlier SubPhase). The birthday automation reads `tenant.settings?.birthdayMessage` at runtime — if the field returns undefined, the default template is used. No schema migration is needed for Phase 04 if the `settings` Json column already exists.

### Step 4: Build the Broadcast API Endpoint

Create `src/app/api/customers/broadcast/route.ts` with a `POST` handler. Authenticate via NextAuth session and extract `tenantId` and the acting user's ID from the session.

The request body schema (Zod): `message` (string, max 1000 chars, required), `filters` (object containing optional `tag: string`, `spendMin: number`, `birthdayMonth: number` between 1–12). Validate and parse the body.

Build the same Prisma `where` clause pattern as `getCustomers` to find all matching customers for this tenant respecting the provided filters. Add `isActive: true` and `deletedAt: null` always.

Before sending, count the matching customers. If the count exceeds 200, return HTTP 422 with `{ error: 'Recipient count exceeds the 200-recipient limit. Refine your filters.' }`. This is a hard server-side cap, not merely a frontend warning.

Create a `CustomerBroadcast` record first (before sending) with `status` or `recipientCount` set to the preliminary count. For each matching customer, call the WhatsApp send function with the customer's `phone` and the message text. Collect a success count. After all sends complete, update the `CustomerBroadcast.recipientCount` to the actual sent count.

Return HTTP 202 with `{ broadcastId, recipientCount: actualSentCount }`. HTTP 202 (Accepted) is used because the send is fast but not transactional — some individual sends may have failed even if the overall operation completes.

### Step 5: Build the Broadcast Builder Page

Create `src/app/dashboard/[tenantSlug]/customers/broadcast/page.tsx` as a Client Component. The layout is a single content card with a heading "Send WhatsApp Broadcast". Render the following form:

- A ShadCN `Textarea` labelled "Message" with a character counter showing remaining characters (1000 max). Placeholder text should be a sample greeting.
- A filter section titled "Recipients" with:
  - A radio group: "All active customers", "Tag filter", "Spend band", "Birthday month".
  - When "Tag filter" is selected, show a tag input appearing below.
  - When "Spend band" is selected, show a number input for "Minimum total spend (Rs.)".
  - When "Birthday month" is selected, show a month selector (Jan–Dec).
- A "Preview Recipients" button that calls `GET /api/customers?count=true` (or a dedicated count endpoint) with the current filter values and displays the resulting count in a muted info card: "This message will be sent to N customers."
- When count is shown and is above 0, enable the "Send Broadcast" button. Disable it if count is 0 or exceeds 200.
- On clicking "Send Broadcast", call the TanStack Query mutation against `POST /api/customers/broadcast`. Show a loading state on the button. On success, show a ShadCN `toast` with "Broadcast sent to N customers." and redirect back to the customer list page.

### Step 6: Register the Cron Job

Document in notes that this endpoint can be triggered by a Vercel Cron Job. The `vercel.json` configuration entry for the cron (not a code block — described as: a JSON file in the project root with a `crons` array, each entry having a `path` of `/api/cron/birthday-greetings` and a `schedule` of `0 2 * * *` meaning 2:00 AM UTC daily — equivalent to 7:30 AM Sri Lanka time) should be created or appended to the existing `vercel.json`.

---

## Expected Output

- `src/app/api/cron/birthday-greetings/route.ts` — GET handler secured by CRON_SECRET.
- `src/app/api/customers/broadcast/route.ts` — POST handler with recipient cap enforcement.
- `src/app/dashboard/[tenantSlug]/customers/broadcast/page.tsx` — broadcast builder UI.
- `BirthdayGreetingLog` records written for every greeting attempt.

---

## Validation

- [ ] Calling the birthday cron endpoint without a valid `Authorization` header returns HTTP 401.
- [ ] Calling it with a valid header on a day where one customer has a matching birthday sends the greeting and creates a `BirthdayGreetingLog` record with `status: "SENT"`.
- [ ] The broadcast endpoint returns HTTP 422 when the computed recipient count exceeds 200.
- [ ] A broadcast to 5 customers creates a `CustomerBroadcast` record with `recipientCount: 5`.
- [ ] The broadcast builder page correctly disables the "Send Broadcast" button when count is 0.
- [ ] The "Preview Recipients" feature shows the correct count when a tag filter is applied.

---

## Notes

- Birthday matching using PostgreSQL `EXTRACT` is sensitive to NULL values in the `birthday` column — always add `birthday IS NOT NULL` to the `$queryRaw` WHERE clause (or handle this via Prisma's `birthday: { not: null }` filter before the raw month/day extraction).
- The birthday message template replacement uses only `[name]` and `[storeName]` as placeholders in Phase 04. More sophisticated templating (e.g., discount codes) is a future enhancement.
- Do not expose `CRON_SECRET` in any client-side bundle. The value is only read server-side in the Route Handler.
- For testing the cron endpoint locally without a real scheduler, call it manually with a tool like `curl` or the VS Code REST Client extension, passing the `Authorization: Bearer [your-secret]` header.
- Timezone handling is critical: a customer born on March 17 should receive the greeting on March 17 in Sri Lanka time regardless of when UTC midnight falls.
