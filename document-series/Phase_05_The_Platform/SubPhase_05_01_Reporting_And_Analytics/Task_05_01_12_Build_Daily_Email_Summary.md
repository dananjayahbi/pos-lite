# Task 05.01.12 — Build Daily Email Summary

## Metadata

| Field        | Value                                                                               |
|--------------|-------------------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                                     |
| Phase        | 05 — The Platform                                                                   |
| Complexity   | Complex                                                                              |
| Dependencies | Resend API key (env var RESEND_API_KEY), pnpm add resend, Shift model, Tenant model, Sale model; DailySummaryLog model must be migrated |

---

## Objective

Implement a scheduled Vercel Cron Job at `GET /api/cron/daily-summary` that runs at 08:00 every morning, queries the previous day's trading figures for every active tenant, composes a branded HTML email via Resend, sends it to each Tenant's Owner user, and logs the outcome to a `DailySummaryLog` table.

---

## Context

Owners who are not physically present at the store each morning still need visibility of yesterday's performance. A concise email arriving at 08:00 with total sales, transaction count, top product, and current cash float replaces the need to log into the dashboard before starting their day. The cron job must process multiple tenants independently so that one tenant's failure does not block others, and every send attempt is logged for auditability.

---

## Instructions

**Step 1: Add the DailySummaryLog model to Prisma schema**

Open `prisma/schema.prisma` and add a new model `DailySummaryLog`. Fields: `id` as `String @id @default(cuid())`, `tenantId` as `String`, `sentAt` as `DateTime @default(now())`, `status` as a string (stored as `String`, values are `"SENT"` or `"FAILED"`), `errorMessage` as `String?` (nullable), `recipientEmail` as `String`. Add `@@index([tenantId])`. Declare the relation: `tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)` and add the back-relation `dailySummaryLogs DailySummaryLog[]` to the `Tenant` model.

Run `pnpm prisma migrate dev --name add_daily_summary_log` to apply the migration.

**Step 2: Install Resend**

Run `pnpm add resend` in the project root. Add `RESEND_API_KEY=re_xxxxxx` and `CRON_SECRET=your_secret_here` to the `.env` file. Add both to `src/env.ts` (or the project's validated env config module) as required string fields. `CRON_SECRET` should be a long random string generated with a tool such as `openssl rand -hex 32`.

**Step 3: Create the email composer module**

Create `src/lib/email/dailySummary.ts`. Define a TypeScript interface `DailySummaryData` with fields: `tenantName: string`, `tenantSlug: string`, `date: string` (formatted as "Sunday, 16 March 2026"), `totalSales: string` (pre-formatted as "LKR 45,200.00"), `transactionCount: number`, `topProductName: string`, `topProductRevenue: string`, `cashFloat: string` (current float value), `ownerName: string`.

Define and export a function `composeDailySummaryEmail(data: DailySummaryData): string` that returns a complete HTML document string. The email uses only inline styles (no external CSS, no style tags with class-based selectors) because many email clients strip `<style>` blocks.

**Step 4: HTML email structure**

The `composeDailySummaryEmail` function returns an HTML string with the following sections, all styled inline:
- An outer table wrapper with `max-width: 600px`, `margin: 0 auto`, `font-family: Georgia, serif` for headings and `Arial, sans-serif` for body text, and a white background.
- A header band with `background-color: #3A2D28` (espresso) containing the "VelvetPOS" logotype in white and below it `data.tenantName` in `color: #CBAD8D` (sand).
- A greeting row: "Good morning, {ownerName}. Here is the summary for {data.date}."
- A stats grid of four cells in a 2×2 table: "Total Sales" showing `data.totalSales` in a large font with `color: #A48374`, "Transactions" showing `data.transactionCount`, "Top Product" showing `data.topProductName` with `data.topProductRevenue`, and "Cash Float" showing `data.cashFloat`.
- A brief message row: "Log in to VelvetPOS to view the full report." with a link button styled as `background-color: #A48374`, `color: white`, `padding: 10px 20px`, `text-decoration: none`, `border-radius: 4px`. The link href is `https://[DOMAIN]/dashboard/{data.tenantSlug}/reports/revenue-trend`.
- A footer row with `background-color: #EBE3DB` (linen) containing "This is an automated daily summary from VelvetPOS. To unsubscribe, contact your account administrator." in small grey text.

**Step 5: Create the cron route handler**

Create `src/app/api/cron/daily-summary/route.ts`. Export a `GET` async function. The first action is to validate the `CRON_SECRET`: read the `Authorization` header value and compare it to `Bearer ${process.env.CRON_SECRET}`. If they do not match, return a `401` JSON response `{ error: "Unauthorized" }` immediately.

**Step 6: Fetch all active tenants and their Owner users**

Call `prisma.tenant.findMany` with `where: { status: "ACTIVE" }`, including `users: { where: { role: "OWNER" }, select: { id: true, name: true, email: true } }`. For tenants with no Owner user, skip them (log a warning but do not throw).

**Step 7: For each tenant, gather yesterday's figures**

Compute `yesterdayStart` and `yesterdayEnd` as the start and end of the previous calendar day using `startOfYesterday()` and `endOfYesterday()` from `date-fns`. For each tenant, run the following queries in parallel:
- `prisma.sale.aggregate` for `tenantId`, `status: "COMPLETED"`, `createdAt` in yesterday's window: `_sum: { totalAmount: true }` and `_count: { id: true }`.
- Top product by revenue: `prisma.saleLine.groupBy` with `by: ["productId"]`, the same window via nested sale relation, `_sum: { lineTotal: true }`, ordered by `_sum.lineTotal` descending, `take: 1`, with product `include`.
- Latest shift float: `prisma.shift.findFirst` with `where: { tenantId }` ordered by `openedAt` descending, selecting `openingFloat` and `closingFloat`. The cash float is the `closingFloat` of the most recent closed shift, or `openingFloat` of the current open shift.

**Step 8: Compose and send the email for each tenant**

Build a `DailySummaryData` object from the queried figures using `decimal.js` to format monetary values. Call `composeDailySummaryEmail(data)` to obtain the HTML string. Instantiate the Resend client with `new Resend(process.env.RESEND_API_KEY)`. Call `resend.emails.send` with `from: "VelvetPOS Reports <reports@yourdomain.com>"`, `to: [ownerEmail]`, `subject: "Daily Summary for {tenantName} — {shortDate}"`, and `html: htmlString`.

**Step 9: Log each send attempt to DailySummaryLog**

Wrap the Resend call in a `try/catch` block. On success, call `prisma.dailySummaryLog.create` with `status: "SENT"`, `recipientEmail`, and `tenantId`. On failure, call `prisma.dailySummaryLog.create` with `status: "FAILED"`, `errorMessage: error.message`, and `recipientEmail`. This ensures every attempt is recorded regardless of outcome.

**Step 10: Return a summary response**

After processing all tenants, return a `200` JSON response with `{ processed: totalTenants, sent: sentCount, failed: failedCount }`. This allows cron monitoring services (e.g., Vercel Cron monitoring or a third-party like Cronitor) to confirm successful runs.

**Step 11: Configure Vercel Cron**

In `vercel.json` at the project root, add a `crons` array entry: `{ "path": "/api/cron/daily-summary", "schedule": "0 8 * * *" }`. This schedules the route to run at 08:00 UTC daily. Note for Sri Lanka (UTC+5:30): 08:00 UTC is 13:30 local time — adjust the schedule hour to `"30 2 * * *"` (02:30 UTC) if the owner prefers to receive the summary at 08:00 local time instead.

---

## Expected Output

- `DailySummaryLog` model migrates cleanly with the `SENT`/`FAILED` string status.
- `GET /api/cron/daily-summary` returns `401` without the correct `CRON_SECRET` header.
- With valid authorisation, it processes all active tenants and sends emails.
- Each send attempt (success or failure) is recorded in `DailySummaryLog`.
- The HTML email renders correctly in Gmail, Outlook, and Apple Mail without external CSS.
- Vercel Cron is configured to trigger the route at the correct UTC time.

---

## Validation

- [ ] Calling the endpoint without the `Authorization` header returns `{ error: "Unauthorized" }` with status `401`.
- [ ] Calling with `Authorization: Bearer wrong_secret` also returns `401`.
- [ ] Calling with the correct `CRON_SECRET` returns `{ processed, sent, failed }` with status `200`.
- [ ] A `DailySummaryLog` record with `status: "SENT"` appears in the database after a successful run.
- [ ] A tenant with no Owner user is skipped without causing the entire job to fail.
- [ ] A Resend API failure for one tenant creates a `FAILED` log and does not stop processing of other tenants.
- [ ] The email HTML passes a basic email client rendering check (no broken tables, inline styles present).
- [ ] The cash float in the email reflects the most recently closed shift's `closingFloat`.
- [ ] `vercel.json` contains the correct cron schedule entry for the `/api/cron/daily-summary` path.
- [ ] `RESEND_API_KEY` and `CRON_SECRET` are present in `.env.example` as placeholder values (not the real keys).

---

## Notes

- The `from` email address must be a verified domain in the Resend dashboard. Use a placeholder like `reports@velvetpos.com` and instruct the operator to verify the domain in Resend before go-live.
- If a tenant's owner email is missing or empty, skip that tenant and log a warning to the console (not to `DailySummaryLog`, as there is no valid recipient to record).
- The route should be idempotent: calling it twice in the same day will create duplicate log entries and duplicate emails. Consider adding a guard that checks `DailySummaryLog` for a `sentAt` within the current UTC day before re-sending, or leave idempotency to the Vercel Cron scheduler (which guarantees at-most-once delivery per scheduled window).
