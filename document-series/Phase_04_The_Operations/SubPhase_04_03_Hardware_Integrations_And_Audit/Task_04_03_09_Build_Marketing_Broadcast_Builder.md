# Task 04.03.09 — Build Marketing Broadcast Builder

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.09 |
| Task Name | Build Marketing Broadcast Builder |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Medium |
| Complexity | Medium |
| Estimated Effort | 3 hours |
| Depends On | Customer model, Customer tags (SubPhase 04.01), Tenant.settings.whatsapp |
| Produces | /dashboard/[tenantSlug]/customers/broadcast page, GET /api/customers/count, POST /api/broadcast/whatsapp |

## Objective

Allow OWNER and MANAGER users to compose a WhatsApp message, select a customer segment using multiple filter dimensions, preview the matching customer count, and send the broadcast. The broadcast API sends messages sequentially with a 1-second delay between each send to respect WhatsApp rate limits, and returns a structured result showing sent and failed counts.

## Instructions

### Step 1: Create the Broadcast Page Route

Create src/app/dashboard/[tenantSlug]/customers/broadcast/page.tsx. Guard the page so that only OWNER and MANAGER roles can access it — redirect CASHIER, STOCK_CLERK, and unauthenticated users. Add a link to this page from the customer list page header as a "Send Broadcast" Button with a megaphone icon.

The page layout uses a two-column grid on desktop (filters on the left, message composer on the right) and single-column stacked on mobile.

### Step 2: Build the Filter Panel

Create a client component src/components/broadcast/BroadcastFilterPanel.tsx. The filter panel contains the following controls:

- Tag filter: a multi-select combobox populated by fetching GET /api/customers/tags (an existing endpoint from SubPhase 04.01 or create a simple one that returns distinct tag values for the tenant). Allows selecting multiple tags; matching customers must have at least one of the selected tags.
- Gender filter: a radio group with options All, Female, Male, and Non-binary / Other. Maps to the Customer.gender field.
- Spend band filter: two number inputs labelled "Min Spend (LTD)" and "Max Spend (LTD)" that filter by Customer.totalSpend (lifetime spend total). Either bound is optional.
- Birthday month filter: a select dropdown with options for each calendar month (January through December) plus an "Any Month" option. Filters customers by EXTRACT(MONTH FROM birthday) matching the selected month.

All filter values are lifted into the parent page as state. When any filter value changes, fire a debounced request (300ms debounce) to GET /api/customers/count to refresh the preview count.

### Step 3: Build the Customer Count Preview

Create src/app/api/customers/count/route.ts as a GET handler. Authenticate the session and derive tenantId. Parse query parameters: tags (comma-separated string), gender (string), minSpend (float), maxSpend (float), birthdayMonth (integer). Build a Prisma where clause for the tenant's customers where deletedAt is null plus any provided filters. Use prisma.customer.count with the where clause and return { count: number }.

Render the count preview in the broadcast page as a prominent callout box between the filter panel and the composer: a sand-coloured box with the text "X customers match your filters" where X is the live count. Show a spinner while the count is loading and show "No customers match" in muted red when count is 0.

### Step 4: Build the Message Composer

Create a client component src/components/broadcast/BroadcastComposer.tsx. The composer contains:

- A plain textarea labelled "Message" with a max character count of 500. Display a live character counter below the textarea (e.g., "342 / 500") that turns red when above 480 characters. The textarea uses monospace text styling (JetBrains Mono) so operators can see the message layout clearly.
- A variable reference guide (a small collapsed accordion or tooltip) listing available template variables: {{name}} for the customer's name, {{storeName}} for the tenant's store name. The broadcast API substitutes these variables per recipient.
- A "Send Broadcast" Button (ShadCN Button, terracotta background). Disabled when: message is empty, message exceeds 500 characters, matching customer count is 0, or a broadcast is currently in progress.

### Step 5: Create the Broadcast API

Create src/app/api/broadcast/whatsapp/route.ts as a POST handler. Authenticate the session (401 if absent, 403 if role is CASHIER or STOCK_CLERK). Parse the request body for: filters (same structure as the count endpoint query params) and message (string, max 500 characters).

Re-query the matching customers using the same filter logic as the count endpoint — do not trust a pre-built customer list from the client. Fetch each customer's name and phone. Also fetch the tenant's WhatsApp API settings.

Iterate through the matching customers sequentially (not in parallel). For each customer:

1. Substitute template variables in the message string: replace every occurrence of {{name}} (case-insensitive) with the customer's first name, and replace {{storeName}} with the tenant's store display name
2. Call the WhatsApp API in the same way as the birthday automation (POST to the configured endpoint with Bearer auth, the customer's phone as to, the substituted message as body text)
3. If the API responds with HTTP 2xx, increment sentCount
4. If the API returns an error or throws, increment failedCount and push the customer's id and the error message to an errors array
5. After each send (success or failure), await a 1-second delay before proceeding to the next customer

After all customers are processed, return: { sent: sentCount, failed: failedCount, total: matchedCount, errors: errors }.

### Step 6: Handle the Broadcast Result

In the broadcast page client component, after the POST /api/broadcast/whatsapp response resolves, display the result in a ShadCN toast:

- If all sends succeeded: a green success toast showing "Broadcast sent to [N] customers"
- If there were failures: a yellow warning toast showing "[N] sent, [M] failed — check your WhatsApp configuration"
- If all failed: a destructive red toast showing "Broadcast failed. Please check your WhatsApp API settings"

Disable the Send Broadcast button and show an inline spinner during the broadcast in progress. Re-enable the button after the result is received.

## Expected Output

- Page at /dashboard/[tenantSlug]/customers/broadcast with role guard and two-column layout
- Live customer count preview updating on filter changes
- Message composer with character counter and template variable guide
- POST /api/broadcast/whatsapp running a sequential send loop with 1-second inter-send delay
- Structured result toast showing sent and failed counts

## Validation

- [ ] Page is inaccessible to CASHIER and STOCK_CLERK roles
- [ ] Selecting a gender filter updates the matching customer count within 300ms of the selection
- [ ] Entering a message over 500 characters disables the Send Broadcast button
- [ ] POST /api/broadcast/whatsapp re-queries customers server-side rather than accepting a client-provided list
- [ ] Template variable {{name}} is replaced with each customer's first name in the sent message
- [ ] A WhatsApp API error for one customer increments failedCount but does not stop the remaining sends
- [ ] The result toast shows the correct sent and failed counts after the broadcast completes
- [ ] Sending while count is 0 is prevented by the disabled button state

## Notes

- The sequential loop with 1-second delay means a broadcast to 500 customers will run for approximately 8 minutes. The POST request will stay open for this duration. This is acceptable in a traditional server deployment; in a serverless environment this request will time out. For large broadcasts in a serverless deployment, the recommended architecture is to enqueue messages to a queue (e.g., Upstash QStash) and process them in batches — document this scaling consideration in a comment in the API route
- Do not log message content in the audit trail or server logs as it may contain customer-facing promotional copy that is commercially sensitive
- The broadcast page should show a confirmation dialog before sending: "You are about to send a WhatsApp message to [N] customers. This action cannot be undone." Use a ShadCN AlertDialog for this confirmation step
