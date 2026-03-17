# Task 04.03.06 — Build Customer Facing Display

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.06 |
| Task Name | Build Customer Facing Display |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Medium |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Depends On | 04.03.07 (SSE endpoint and POST /api/cfd/update must exist first) |
| Produces | /dashboard/[tenantSlug]/cfd page (no sidebar, no header) |

## Objective

Build a full-screen, kiosk-style Customer Facing Display (CFD) route that a second monitor in a POS station can load and keep open. The CFD subscribes to the live cart via Server-Sent Events and transitions between three visual states — Idle, Active, and Complete — as the cashier interacts with the POS terminal.

## Context

The CFD is a dedicated route that must have no application chrome (no sidebar, no top navigation bar). It is intended to be opened in a full-screen browser window on a customer-facing monitor. The VelvetPOS espresso, linen, and pearl colour palette should dominate the display, creating a warm and premium aesthetic appropriate for boutique retail environments.

The SSE subscription is managed entirely client-side using the browser's EventSource API. Cart state is received as JSON payloads in the data field of each SSE event. The CFD does not authenticate or require a session — it is inherently a local-network display and the SSE stream is scoped by tenantSlug in the URL.

## Instructions

### Step 1: Create the CFD Route

Create src/app/dashboard/[tenantSlug]/cfd/page.tsx. This page must not inherit the dashboard layout (sidebar and header). To achieve this, ensure the cfd page is not wrapped by the [tenantSlug] layout component. In the Next.js App Router, this is achieved by placing the cfd route outside the layout boundary — for example by creating src/app/cfd/[tenantSlug]/page.tsx as a separate route tree with its own minimal layout, or by using a route group without a layout. Choose the approach that cleanly avoids the dashboard chrome. Update any route references accordingly.

The page is a client component (add "use client" directive). It renders a full-viewport div with background colour linen (#EBE3DB), zero margin, and no overflow.

### Step 2: Implement the SSE Subscription

Inside the CFD page component, declare a state value cartState initialised to null. Use a useEffect hook to create an EventSource pointing to /api/cfd/stream?tenantSlug=[tenantSlug] where tenantSlug is extracted from the URL using Next.js useParams.

Register an onmessage handler on the EventSource that parses the event.data field as JSON and updates cartState with the parsed payload. Register an onerror handler that logs a warning and does not crash the component — EventSource automatically reconnects by default.

Return a cleanup function from the useEffect that calls eventSource.close() to cleanly terminate the connection when the component unmounts.

### Step 3: Build the Idle State

When cartState is null or cartState.items is an empty array, display the Idle screen. The Idle screen occupies the full viewport and contains:

- The store name in Playfair Display, large (text-5xl), centred, colour espresso (#3A2D28), positioned in the upper-centre third of the screen
- A tagline such as "Welcome" or the tenant's custom idle message, in Inter, text-xl, colour terracotta (#A48374), centred below the store name
- The current time displayed in text-3xl JetBrains Mono, centred, colour sand (#CBAD8D), updating every second via a setInterval in a separate useEffect
- A subtle full-width footer bar in espresso colour at the bottom, 6px tall, as a brand accent

### Step 4: Build the Active State

When cartState.items has one or more entries, display the Active screen. The screen is divided into two zones: a scrollable items list occupying 65% of the viewport height, and a fixed totals panel at the bottom occupying 35%.

Items list: render each cart item as a row with three columns — product name and variant name (combined, Inter text-base, espresso colour), quantity (JetBrains Mono, text-lg, right of product, muted sand), and line total (quantity × unit price, JetBrains Mono text-base, right-aligned). Each row has a bottom border in mist (#D1C7BD). Animate newly added rows with a subtle fade-in using a CSS transition or Framer Motion enter animation.

Totals panel: render a card in linen background with a sand border. Display Subtotal, applied Discounts (if any, in terracotta colour with a minus sign), and Total in a stacked right-aligned column. The Total value is displayed in JetBrains Mono text-4xl in espresso colour. If applied promotions are present in cartState.appliedPromotions, render each promotion name as a small badge in terracotta below the subtotal.

If cartState.customerName is present, display "Customer: [name]" in Inter text-sm, muted, at the top-left of the totals panel.

### Step 5: Build the Complete State

When cartState.status is "COMPLETE", display the Complete screen. The Complete screen shows:

- A large checkmark icon (ShadCN CheckCircle or Lucide CheckCircle2) in terracotta, centred, text-8xl
- "Thank You!" in Playfair Display text-5xl, espresso, centred below the icon
- The total amount paid in JetBrains Mono text-4xl, centred, in espresso
- The change due (if payment method was CASH) in Inter text-xl, terracotta: "Change: [amount]"
- A line "Have a wonderful day!" in Inter text-lg, sand, centred

After 8 seconds on the Complete screen, automatically transition back to Idle by setting cartState back to null using a useEffect timeout. Clear the timeout in the cleanup function.

## Expected Output

- Full-screen CFD page accessible at /cfd/[tenantSlug] or /dashboard/[tenantSlug]/cfd without any dashboard chrome
- Idle, Active, and Complete states rendering correctly according to live SSE cart data
- Clean EventSource lifecycle (open on mount, close on unmount)
- Auto-reset to Idle 8 seconds after showing the Complete screen

## Validation

- [ ] Opening the CFD page shows the Idle screen by default with no sidebar or header visible
- [ ] Sending a cart update event with items via POST /api/cfd/update transitions the CFD to the Active state
- [ ] Cart items render with correct product name, quantity, and line total
- [ ] Sending a COMPLETE status event triggers the Complete screen showing the total paid
- [ ] The CFD automatically returns to Idle 8 seconds after showing the Complete screen
- [ ] The current time on the Idle screen updates every second without re-mounting the component
- [ ] EventSource.close() is called when the component unmounts (verified in browser DevTools)

## Notes

- The CFD page does not require authentication. This is intentional — it is a local-network display. Do not add session guards to this route
- Ensure the cfd route layout file (if created) sets html and body CSS to height 100vh and overflow hidden to prevent scrollbars from appearing on the display
- To avoid showing the default linen background between state transitions, apply an immediate CSS opacity transition of 200ms on state changes
