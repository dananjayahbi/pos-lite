# Task 05.03.02 — Build Outbound Webhook System

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.02 |
| Task Name | Build Outbound Webhook System |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | High |
| Estimated Duration | 4–6 hours |
| Assignee Role | Lead Developer |
| Dependencies | Prisma models finalized, sale.service.ts, return.service.ts, stock adjustment service |
| Output Files | prisma/schema.prisma (updated), src/lib/webhooks/dispatch.ts, src/lib/webhooks/generate-secret.ts, webhook API routes, webhook management UI page |

## Objective

Implement a complete outbound webhook system that allows tenant owners to register external HTTP endpoints and receive signed event notifications when key business actions occur inside VelvetPOS. The system consists of two new Prisma models, a cryptographically signed dispatch service, fire-and-forget integration into the sale and return service flows, a RESTful management API, and a settings UI where tenants register and inspect their endpoints.

## Context

Webhooks enable tenants to integrate VelvetPOS with their own downstream systems — for example, triggering a logistics dispatch on sale.completed, updating an external inventory spreadsheet on stock.adjusted, or sending a custom loyalty message on customer.created. The dispatch function is intentionally fire-and-forget: it does not block the primary transaction and individual endpoint failures are logged to the WebhookDelivery table for operator review without surfacing to the end user. The HMAC-SHA256 signature in the X-VelvetPOS-Signature header allows the receiving server to verify that the payload originated from VelvetPOS and was not tampered with in transit.

## Instructions

**Step 1: Define the Prisma Models**

Open prisma/schema.prisma and add two new models. The WebhookEndpoint model has the following fields: id as String with @id and @default(cuid()), tenantId as String referencing the Tenant model, url as String storing the destination HTTPS URL, secret as String storing a 64-character hex value generated at creation time, isActive as Boolean with @default(true), events as String array (String[]) storing event type strings such as "sale.completed" and "stock.low", and createdAt as DateTime with @default(now()). Add a relation field on the Tenant model back to WebhookEndpoint.

The WebhookDelivery model has: id as String with @id and @default(cuid()), webhookEndpointId as String referencing WebhookEndpoint, event as String, payload as Json storing the full event payload at time of dispatch, statusCode as Int nullable (populated from the HTTP response), response as String nullable (first 1,000 characters of the response body), status as the WebhookDeliveryStatus enum, and attemptedAt as DateTime with @default(now()). Define the WebhookDeliveryStatus enum with three values: PENDING, SUCCESS, and FAILED. Run pnpm prisma migrate dev --name add_webhook_models to apply the migration. Regenerate the Prisma client with pnpm prisma generate.

**Step 2: Build the Secret Generator**

Create the file src/lib/webhooks/generate-secret.ts. Inside, export a single function generateWebhookSecret. The function imports randomBytes from Node's built-in "crypto" module and returns the result of randomBytes(32).toString("hex"), which produces a cryptographically random 64-character hexadecimal string. This function is called exactly once at endpoint registration time. The resulting secret is stored in the database and transmitted to the tenant in the API creation response — it is never shown again after that moment, analogous to an API key reveal flow.

**Step 3: Build the Dispatch Function**

Create the file src/lib/webhooks/dispatch.ts. Export an async function dispatchWebhooks that accepts three parameters: tenantId as string, event as string, and payload as a plain object (typed as Record&lt;string, unknown&gt;). The function body executes the following logic in sequence.

First, query WebhookEndpoint records from the database using prisma.webhookEndpoint.findMany where both tenantId matches and isActive is true and the events array contains the given event string (use the Prisma array filter syntax with the "has" operator: events: { has: event }).

Second, for each matching endpoint, convert the payload to a string with JSON.stringify. Compute the HMAC-SHA256 signature using Node's crypto module: import createHmac from "crypto", call createHmac("sha256", endpoint.secret).update(stringifiedPayload).digest("hex"), then prefix the result with "sha256=" to produce the final signature string. Prepare the request headers object to include Content-Type set to "application/json", X-VelvetPOS-Signature set to the computed signature, X-VelvetPOS-Event set to the event string, and X-VelvetPOS-Timestamp set to a new Date().toISOString() value.

Third, send the POST request using the global fetch API with a 2-second timeout. Implement the timeout via AbortController: instantiate a controller, call setTimeout(() => controller.abort(), 2000) and store the timer reference, and pass controller.signal to the fetch call's signal option. Wrap the fetch in a try/catch. In the success branch, read the response status code and read up to 1,000 characters of the response body text. In the catch branch (which covers both timeout and network errors), set the statusCode to null and response to the error message. Cancel the abort timer in a finally block by calling clearTimeout on the stored reference.

Fourth, write a WebhookDelivery record to the database using prisma.webhookDelivery.create. Determine the status value: if an HTTP response was received (no exception thrown), use SUCCESS regardless of the HTTP status code; if the fetch threw an exception, use FAILED. Always set the status to PENDING in the initial upsert and resolve later if desired — for this implementation, set the final status directly without an initial PENDING write, keeping the delivery log accurate and simple.

Fifth, wrap the entire per-endpoint processing block in its own try/catch so that a failure delivering to one endpoint never blocks delivery to remaining endpoints.

**Step 4: Integrate Dispatch into Service Layers as Fire-and-Forget**

In src/lib/services/sale.service.ts, locate the createSale function. After the Prisma transaction commits and the new sale record is confirmed, add a single non-awaited call to dispatchWebhooks. Pass the tenantId, the event string "sale.completed", and a payload summary object containing: saleId, totalAmount as a string (from decimal.js .toString()), itemCount as a number, and customerId (may be null for anonymous sales). Prefix the call with void to signal intentional non-await and suppress TypeScript warnings about unawaited promises.

Apply the same pattern in src/lib/services/return.service.ts: after initiateReturn successfully commits, call dispatchWebhooks with event "return.initiated" and a payload containing returnId, originalSaleId, refundAmount, and reason. In the stock adjustment service, call dispatchWebhooks after any manual quantity adjustment with event "stock.adjusted" and a payload containing productId, variantId, previousQuantity, newQuantity, and adjustmentReason.

**Step 5: Create the Webhook Endpoints API**

Create the file src/app/api/[tenantSlug]/webhooks/endpoints/route.ts with two handlers. The GET handler authenticates the session, verifies the requesting user has OWNER or MANAGER role, queries all WebhookEndpoint records for the tenant, and returns them as a JSON array. In the Prisma select, explicitly exclude the secret field by using a select clause that lists all fields except secret. Returning secrets in list responses is a security violation.

The POST handler validates the request body using a Zod schema: url must be a valid HTTPS URL (use z.string().url() and add a refine check that the value starts with "https://"), events must be a non-empty string array where each value is one of the five known event types (sale.completed, return.initiated, stock.adjusted, stock.low, customer.created). On validation success, generate a new secret using generateWebhookSecret, create the WebhookEndpoint record, and return HTTP 201 with the full record including the secret field. Add a comment in code noting this is the only response that includes the raw secret.

Create src/app/api/[tenantSlug]/webhooks/endpoints/[endpointId]/route.ts with a DELETE handler that verifies the endpoint belongs to the current tenant before deleting (prevent horizontal privilege escalation by always filtering by both endpointId and tenantId in the where clause).

Create src/app/api/[tenantSlug]/webhooks/endpoints/[endpointId]/test/route.ts with a POST handler that constructs a synthetic test payload (event: "test.ping", timestamp, endpointId) and dispatches it to that single endpoint by calling dispatchWebhooks with the synthetic data. Return the resulting WebhookDelivery record so the UI can show the outcome.

**Step 6: Build the Webhook Management UI**

Create src/app/(dashboard)/[tenantSlug]/settings/webhooks/page.tsx. The page renders in two sections. The top section is a table of registered endpoints with columns: Destination URL (truncated to 50 characters with a tooltip), Subscribed Events (displayed as pill badges in sand on espresso text), Status (Active shown in terracotta, Inactive shown in mist), Last Delivery Status (the most recent WebhookDelivery status badge — Success in terracotta green variant, Failed in destructive red, no deliveries shown as an em dash), and two action buttons per row: a Test button and a Delete button.

The bottom section is an "Add Webhook Endpoint" form built with React Hook Form and Zod. Fields: Endpoint URL (text input, validated as HTTPS), and a checkbox group for selecting subscribed events. On submission, the form calls the POST /api/[tenantSlug]/webhooks/endpoints route. On HTTP 201 success, display the returned secret in a one-time reveal modal using a ShadCN Dialog. Inside the dialog, show the secret in a monospace JetBrains Mono text block with a copy-to-clipboard button, and display a muted warning paragraph reading "This secret will not be shown again. Store it securely now."

## Expected Output

- prisma/schema.prisma — WebhookEndpoint and WebhookDelivery models, WebhookDeliveryStatus enum
- prisma/migrations/[timestamp]_add_webhook_models/ — Applied Prisma migration files
- src/lib/webhooks/dispatch.ts — HMAC-signed dispatch function with delivery logging and 2-second timeout
- src/lib/webhooks/generate-secret.ts — Cryptographic 32-byte hex secret generator
- src/app/api/[tenantSlug]/webhooks/endpoints/route.ts — GET (list, no secret) and POST (create, returns secret once) handlers
- src/app/api/[tenantSlug]/webhooks/endpoints/[endpointId]/route.ts — DELETE handler with tenant ownership check
- src/app/api/[tenantSlug]/webhooks/endpoints/[endpointId]/test/route.ts — Test delivery trigger handler
- src/app/(dashboard)/[tenantSlug]/settings/webhooks/page.tsx — Endpoint list table and Add Endpoint form with one-time secret modal

## Validation

- [ ] pnpm prisma migrate dev --name add_webhook_models applies cleanly with no drift errors
- [ ] dispatchWebhooks is called without await in sale.service.ts, return.service.ts, and the stock adjustment service
- [ ] A test receiver (e.g., webhook.site or smee.io) receives POST requests with X-VelvetPOS-Signature header present
- [ ] The HMAC-SHA256 signature on a received request is verifiable using the stored endpoint secret and the raw request body
- [ ] A deliberate 3-second delay on the test receiver causes the dispatch to timeout and log a FAILED WebhookDelivery record
- [ ] The GET endpoints list response never includes the secret field for any endpoint
- [ ] The POST create response includes the secret field exactly once in the HTTP 201 body
- [ ] The one-time secret modal in the UI is dismissible and the secret does not reappear on the page after dismissal
- [ ] Deleting an endpoint for tenant A from tenant B's session is rejected with HTTP 403

## Notes

- The events field is stored as a PostgreSQL String[] and filtered using Prisma's array "has" operator. This is efficient for small event arrays (under 10 items) but should be indexed if event-based queries become frequent.
- A retry mechanism — re-dispatching FAILED deliveries up to 3 times with exponential backoff via a cron job — is strongly recommended as a future iteration. Leave a TODO comment in dispatch.ts pointing to the retry cron job implementation.
- Reject HTTP (non-HTTPS) URLs at the API validation layer always. Allowing HTTP webhook URLs creates a server-side request forgery (SSRF) risk where an attacker could register internal IP addresses or private hostnames as webhook targets.
