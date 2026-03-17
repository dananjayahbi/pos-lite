# Task 04.03.07 — Build CFD Server-Sent Events Endpoint

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.07 |
| Task Name | Build CFD Server-Sent Events Endpoint |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Medium |
| Complexity | Medium |
| Estimated Effort | 2 hours |
| Depends On | Phase 03 POS cart Zustand store (CartPanel must dispatch updates) |
| Produces | GET /api/cfd/stream, POST /api/cfd/update, module-level EventEmitter |

## Objective

Implement the server-side event streaming infrastructure that connects the POS terminal's cart state to the Customer Facing Display. The POS terminal pushes cart changes to a server endpoint, which fans them out to all open SSE connections for the relevant tenant slug.

## Context

Server-Sent Events (SSE) is a one-directional HTTP streaming mechanism where the server pushes text/event-stream formatted messages to a connected client. The browser-native EventSource API handles reconnection automatically. SSE is lighter than WebSockets and sufficient for the one-way POS→CFD data flow.

The fan-out mechanism in this implementation uses a module-level Node.js EventEmitter. When the Node.js server process is a single persistent instance (local development, traditional VPS deployment), the emitter is shared across all API route invocations and events propagate correctly. In a serverless deployment model where each API route invocation runs in a separate, stateless function instance (as is the case with Vercel's default serverless functions), there is no shared module state and the EventEmitter approach will not propagate events between instances.

This limitation is a known, documented constraint of this implementation. The production upgrade path is to replace the module-level emitter with a Redis pub/sub channel (using ioredis or the Upstash Redis client), where the POST endpoint publishes to a channel and all SSE route instances subscribe to that channel. This upgrade is out of scope for this SubPhase.

## Instructions

### Step 1: Create the Shared EventEmitter Module

Create a file at src/lib/cfdEmitter.ts. Import EventEmitter from the Node.js events module. Create a single exported instance: export the emitter as velvetPOSCFDEmitter, instantiated as a new EventEmitter. Increase the maximum listener count to 50 using emitter.setMaxListeners(50) to prevent Node.js warnings when many CFD connections are open simultaneously.

Define and export a TypeScript type CFDCartPayload representing the data shape that the POS terminal sends. The type should include: tenantSlug (string), items (array of objects with productName, variantName, quantity, unitPrice, lineTotal), subtotal (number), discount (number), total (number), appliedPromotions (array of objects with id and name), customerName (string optional), status (union of "ACTIVE" | "COMPLETE" | "IDLE"), and change (number, optional, present when status is COMPLETE and payment was CASH).

### Step 2: Create the SSE Stream Route

Create src/app/api/cfd/stream/route.ts as a Next.js App Router GET route handler. The handler must set response headers: Content-Type to "text/event-stream", Cache-Control to "no-cache, no-store", Connection to "keep-alive", and X-Accel-Buffering to "no" (the last header disables Nginx proxy buffering if a reverse proxy is in front of the server).

Extract the tenantSlug from the URL search parameters. Generate an event name unique to this tenant's cart channel, such as "cfd-update-[tenantSlug]".

Return a new Response using a ReadableStream. Inside the ReadableStream start function, define a listener function that formats the incoming CFDCartPayload as an SSE-formatted string and enqueues it to the stream controller. The SSE format for a cart update event is: the literal text "data: " followed by JSON.stringify(payload) followed by two newline characters ("\n\n"). Register the listener on velvetPOSCFDEmitter for the tenant event name.

Send an initial keepalive comment immediately upon connection: enqueue the string ": keepalive\n\n" so the browser EventSource knows the connection is established. Register a cancel callback on the ReadableStream that removes the listener from the emitter when the client disconnects.

### Step 3: Create the Cart Update Endpoint

Create src/app/api/cfd/update/route.ts as a POST route handler. Authenticate the session (return 401 if no session is present). Parse the JSON request body into a CFDCartPayload. Validate that tenantSlug is present in the body. Emit the payload on velvetPOSCFDEmitter using the same event name pattern "cfd-update-[tenantSlug]". Return a JSON response { ok: true }.

### Step 4: Wire the POS Terminal Cart to the CFD Update Endpoint

In the POS terminal's cart Zustand store (typically at src/store/cartStore.ts or similar, established in Phase 03), add an effect or middleware that dispatches a POST to /api/cfd/update with the current cart state. This dispatch should fire on every cart mutation: when an item is added, removed, or has its quantity changed, when a customer is linked or unlinked, when a promotion is applied or removed, and when the sale is completed or reset.

Implement the dispatch as a fire-and-forget fetch call using a helper function sendCFDUpdate(cartData: CFDCartPayload). Call this helper at the end of each Zustand action that modifies cart state. If the POST fails (network error), log a warning to the console and do not show an error to the cashier — CFD updates are best-effort.

When the POS cart is reset after a completed sale, dispatch a CFD update with status "IDLE" and an empty items array to return the CFD to its idle screen.

### Step 5: Document the Serverless Limitation

Add a comment block at the top of src/lib/cfdEmitter.ts clearly documenting the single-instance limitation:

In prose: the module-level EventEmitter approach works correctly when all API route invocations share a single Node.js process, as is the case in local development and traditional server deployments. In Vercel's default serverless deployment, each function invocation is independent and does not share module state. As a result, the POST /api/cfd/update handler and the GET /api/cfd/stream handler may run in different function instances and the emitter event will not reach the SSE clients. The production upgrade path is to use a Redis pub/sub channel — the POST handler publishes to Redis and the SSE handler subscribes to Redis — so that events propagate across all function instances.

## Expected Output

- src/lib/cfdEmitter.ts with velvetPOSCFDEmitter and CFDCartPayload type
- GET /api/cfd/stream returning a persistent SSE response with proper headers
- POST /api/cfd/update accepting cart payloads and emitting to the shared emitter
- POS cart Zustand store dispatching sendCFDUpdate on all cart mutations
- Documented serverless limitation in the emitter module

## Validation

- [ ] Connecting to GET /api/cfd/stream in a browser tab keeps the connection open indefinitely without timing out
- [ ] Sending a POST to /api/cfd/update with a cart payload causes the connected SSE client to receive the event within 200ms
- [ ] Adding an item in the POS terminal triggers an automatic POST to /api/cfd/update with the updated cart
- [ ] Completing a sale in the POS terminal triggers a CFD update with status "COMPLETE"
- [ ] Resetting the POS cart after sale completion triggers a CFD update with status "IDLE"
- [ ] Disconnecting the EventSource (closing the CFD browser tab) removes the listener from velvetPOSCFDEmitter

## Notes

- The tenantSlug from the URL parameter must be validated against the authenticated session's tenant in the POST /api/cfd/update route — a CASHIER at tenant A must not be able to push cart updates to tenant B's CFD stream. Extract the tenantSlug from the session rather than trusting the request body
- Keep the SSE message payload small — include only the fields the CFD page renders. Avoid sending full Prisma model objects; shape the data in the cart Zustand store or in a mapping function before dispatching
- If the Node.js event loop is idle for long periods, some load balancers and proxies will close the SSE connection with a timeout. Mitigate this by enqueuing a ": keepalive\n\n" comment every 20 seconds using a setInterval in the SSE ReadableStream start function. Clear the interval in the cancel callback
