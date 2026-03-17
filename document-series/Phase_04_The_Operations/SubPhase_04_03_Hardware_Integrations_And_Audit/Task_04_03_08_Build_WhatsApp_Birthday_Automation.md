# Task 04.03.08 — Build WhatsApp Birthday Automation

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.08 |
| Task Name | Build WhatsApp Birthday Automation |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Medium |
| Complexity | Medium |
| Estimated Effort | 2 hours |
| Depends On | Customer Prisma model, Tenant.settings.whatsapp configuration (SubPhase 04.01) |
| Produces | GET /api/cron/birthday-messages endpoint, Customer schema migration (lastBirthdayMessageSentYear) |

## Objective

Implement an automated birthday greeting system that sends a personalised WhatsApp message to every customer whose birthday falls on today's date, once per calendar year, across all tenants. The endpoint is designed to be triggered by a Vercel Cron Job at 8am daily.

## Context

This automation runs as a cron-triggered API route rather than a standalone worker process. Vercel Cron Jobs call a specified HTTP endpoint on a schedule defined in the vercel.json configuration file. The endpoint is protected by a shared secret passed in a request header, preventing unauthorised external triggers.

The per-year deduplication is enforced by the Customer.lastBirthdayMessageSentYear field — an integer that stores the most recent calendar year a birthday message was successfully sent to that customer. If lastBirthdayMessageSentYear equals the current year, the message is skipped. After a successful send, the field is updated to the current year.

Birthday matching uses the month and day components of the Customer.birthday date field. The matching is done in the database query using Prisma's raw query capability or by using the database's date extraction functions to compare month and day independently of year.

## Instructions

### Step 1: Add lastBirthdayMessageSentYear to the Customer Model

Open prisma/schema.prisma and locate the Customer model. Add a field: lastBirthdayMessageSentYear with type Int and modifier "?" (nullable). Place it after the existing birthday field for logical grouping.

Run pnpm prisma migrate dev --name add_last_birthday_message_sent_year to generate and apply the migration. Run pnpm prisma generate to regenerate the Prisma client.

### Step 2: Create the Cron Endpoint File

Create src/app/api/cron/birthday-messages/route.ts as a GET route handler. At the very beginning of the handler, extract the x-cron-secret header from the incoming request. Compare it to the CRON_SECRET environment variable using a timing-safe comparison (import timingSafeEqual from the Node.js crypto module, converting both strings to buffers before comparing). If the values do not match, return a 401 JSON response immediately. This prevents unauthorised external invocations.

### Step 3: Determine Today's Birthday Match Criteria

Inside the handler, create a Date object representing today in the server's local time zone. Extract the month as a 1-based integer (e.g., 3 for March) and the day as a 1-based integer (e.g., 17 for the 17th). Also capture the current full year as an integer.

### Step 4: Query Matching Customers

Use a Prisma raw query to find customers whose birthday month and day match today, whose lastBirthdayMessageSentYear is either null or not equal to the current year, and whose deletedAt is null. The raw SQL query should use EXTRACT(MONTH FROM birthday) and EXTRACT(DAY FROM birthday) to perform month-and-day matching regardless of the year stored in the birthday column.

The query should return customer id, name, phone, tenantId, and lastBirthdayMessageSentYear. Also join or separately fetch the Tenant record for each distinct tenantId to retrieve the tenant's WhatsApp API settings (endpointUrl, apiKey, senderPhoneNumber stored in settings.whatsapp).

Group customers by tenantId to avoid redundant tenant fetches. If a tenant has no WhatsApp settings configured, skip all customers belonging to that tenant and log a warning.

### Step 5: Send Birthday Messages

For each qualifying customer (with a configured tenant), call the tenant's WhatsApp API. The message template is: "Happy Birthday [customer name]! 🎂 Come celebrate with us at [store name] — show this message for a special treat." where [customer name] is replaced with the customer's first name and [store name] is replaced with the tenant's store display name.

Call the WhatsApp API using a fetch POST request to the tenant's configured endpointUrl. Include the tenant's apiKey as a Bearer token in the Authorization header. Include the customer's phone number and the message body in the request JSON body formatted according to the WhatsApp Business API standard structure: a messages array with a single object containing to (phone), type "text", and text { body: messageText }.

After a successful API response (HTTP 2xx), update the customer record: call prisma.customer.update setting lastBirthdayMessageSentYear to the current year. Track sent and failed counts in local counter variables.

### Step 6: Return Results and Log

After processing all customers, return a JSON response body: { processed: totalCount, sent: sentCount, failed: failedCount, skipped: skippedCount }. Log a summary line to console.info with these counts and a list of any customer ids that failed to send, to assist with debugging.

### Step 7: Configure Vercel Cron Job

In the project root vercel.json file (create it if it does not exist), add a crons array entry. The cron expression "0 8 * * *" schedules execution at 08:00 UTC every day. The path field should be "/api/cron/birthday-messages". The full entry is a JSON object with path and schedule fields.

Also add CRON_SECRET to the project's environment variable list in the Vercel dashboard and in the local .env.local file. Generate a secure random value of at least 32 characters for this secret. Document its purpose in the .env.example file with a placeholder value.

## Expected Output

- Customer model with new lastBirthdayMessageSentYear Int nullable field and corresponding migration
- GET /api/cron/birthday-messages route protected by CRON_SECRET header check
- Birthday matching logic using month and day extraction (year-independent)
- Per-year deduplication via lastBirthdayMessageSentYear comparison
- WhatsApp send using tenant-configured API endpoint and credentials
- vercel.json with cron job configuration at 08:00 UTC daily

## Validation

- [ ] Migration applies cleanly and all existing customer records have lastBirthdayMessageSentYear as null
- [ ] Calling GET /api/cron/birthday-messages without the correct x-cron-secret header returns 401
- [ ] A customer with a birthday matching today's month and day and lastBirthdayMessageSentYear is null is included in the batch
- [ ] A customer with a birthday matching today and lastBirthdayMessageSentYear equal to the current year is skipped
- [ ] A customer with deletedAt set is excluded from the query
- [ ] A successful send updates the customer's lastBirthdayMessageSentYear to the current year
- [ ] A tenant with no WhatsApp settings is skipped without crashing the handler

## Notes

- The birthday field stores a full date (e.g., 1992-03-17). Use EXTRACT(MONTH FROM "birthday") = 3 AND EXTRACT(DAY FROM "birthday") = 17 in the SQL WHERE clause for month-and-day matching. This works for PostgreSQL. For other databases, the function names differ
- Prisma's queryRaw returns results as typed records; use the correct generic to match the selected column shape
- Add a 200ms delay between sends using a small setTimeout-based helper to avoid hitting rate limits on the WhatsApp API. This is especially important for tenants with large customer databases
- This endpoint should be idempotent — running it twice on the same day must not send duplicate messages, because the lastBirthdayMessageSentYear check prevents re-sending within the same calendar year
