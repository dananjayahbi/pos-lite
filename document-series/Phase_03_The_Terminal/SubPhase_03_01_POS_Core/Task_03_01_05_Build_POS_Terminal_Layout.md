# Task 03.01.05 — Build POS Terminal Layout

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.05 |
| Task Name | Build POS Terminal Layout |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_04 |
| Output Files | src/app/dashboard/[tenantSlug]/pos/layout.tsx, src/app/dashboard/[tenantSlug]/pos/page.tsx, src/components/pos/ShiftOpenModal.tsx, src/components/pos/ShiftCloseModal.tsx |

## Objective

Build the special full-screen POS terminal layout that replaces the standard dashboard sidebar and top navigation, enforce shift-gate access (redirecting to the ShiftOpenModal when no open shift exists), define the two-panel responsive grid structure that all POS child components will inhabit, and document the visual design intent for the terminal environment.

## Instructions

### Step 1: Create the POS Layout Server Component

Create src/app/dashboard/[tenantSlug]/pos/layout.tsx as a Next.js server component. At the top of the file, retrieve the current session using the NextAuth getServerSession function. If no session exists or the session does not include a userId, redirect to the login page. Extract the tenantSlug from the route params and resolve the tenantId by querying the Tenant table by its slug field.

Perform an RBAC permission check to confirm the authenticated user has the pos:access permission in the resolved tenant. Use the existing hasPermission utility from Phase 01's RBAC system. If the user lacks pos:access, redirect them to /dashboard/[tenantSlug] (the standard dashboard home) rather than showing a 403 error page — cashiers who are accidentally navigating to the POS URL from a restricted account will return to safe ground without a confusing error.

Next, call getCurrentShift from shift.service.ts, passing the tenantId and the session userId. If getCurrentShift returns null (no open shift), render a full-screen wrapper that shows only the ShiftOpenModal component rather than the terminal interface. The ShiftOpenModal must block all access to the POS until a shift is opened — it cannot be dismissed by pressing Escape, clicking an overlay, or navigating away using browser controls. Render it against a dark espresso background with no navigation visible. Pass the tenantId and cashier name from the session as props to the ShiftOpenModal.

If an open shift exists, render the layout wrapper and slot the children (the POS page content) inside it.

### Step 2: Define the Two-Panel Layout Structure

The layout wrapper element should be a full-viewport flex container using height of 100dvh (dynamic viewport height) to correctly handle mobile browser address-bar resizing. The background of this outermost container is the espresso colour (#3A2D28), which fills any gap that might appear between panels during resizing. Set overflow to hidden on the container to prevent any browser scroll affordances from appearing.

The interior of the layout contains two direct child panels. The left panel (product area) occupies approximately 63% of the horizontal space on desktop and the full width on mobile. Apply the espresso colour to the left panel's top navigation strip (the slim bar housing the search input and category tabs), while the main product grid area uses linen (#EBE3DB) as its background to create a light retail display atmosphere that makes product thumbnails visually distinct. The left panel is vertically scrollable.

The right panel (cart area) occupies approximately 37% of the horizontal space on desktop. It uses pearl (#F1EDE6) as its background to provide gentle differentiation from the product grid. The right panel is fixed in position on desktop — it does not scroll with the left panel. It has a persistent, always-visible presence; there is no toggle, drawer, or collapse mechanism on desktop. On devices narrower than 768px (tablet portrait and below), the left and right panels stack vertically, with the cart panel appearing below the product grid, and the POS page layout uses a scrollable single-column design instead of the two-column split.

### Step 3: Design the POS-Specific Top Bar

Within the POS layout, render a slim top bar (approximately 48px in height) across the full width. This bar replaces the standard dashboard navigation. Its background is espresso. It contains three elements: on the left, the VelvetPOS wordmark or the store name from the tenant record rendered in a small sand-coloured Playfair Display typeface; in the centre, a compact shift indicator showing the cashier's name and how long the shift has been open (a live clock derived from the shift's openedAt timestamp in the client component); and on the right, two icon buttons — a "History" link navigating to /dashboard/[tenantSlug]/pos/history, and a "Close Shift" button that opens the ShiftCloseModal. These buttons use muted terracotta (#A48374) as their icon colour and transition to pearl on hover.

### Step 4: Document and Build the ShiftOpenModal

Create src/components/pos/ShiftOpenModal.tsx as a client component. This component renders as an absolutely positioned full-screen overlay with an espresso background and no dismiss mechanism. It centres a compact white card (using the pearl background colour) containing the following elements.

The card header shows the VelvetPOS logo or store name and a subtitle reading "Open Your Shift" in Playfair Display. Below the header, a brief instructional paragraph explains that the cashier must enter the opening float amount — the cash currently in the till — before any sales can be processed. The opening float input is a numerical input with an "Rs." prefix label, styled with a mist border that transitions to sand on focus. The input accepts decimal values to two decimal places.

A full-width "Start Shift" button uses the espresso background with pearl text. When clicked, the component calls POST /api/shifts with the opening float value. On success, the page is refreshed using router.refresh() from Next.js navigation, which re-executes the layout server component and loads the full terminal now that an open shift exists. On API error (for example, a ConflictError if a race condition creates a second shift), display an inline error message below the button without navigating away. Show a loading spinner on the button during the API call to prevent double submissions.

### Step 5: Document and Build the ShiftCloseModal

Create src/components/pos/ShiftCloseModal.tsx as a client component triggered by a button in the POS top bar. Use a ShadCN Dialog. The modal presents the closing cash count step: a single numerical input with Rs. prefix and a label "Count your till and enter total cash". Below the input, display a live preview of the expected cash and the projected discrepancy (pulled from a preloaded summary from GET /api/shifts/[id]) so the cashier can see the difference before confirming. An optional notes textarea (maximum 500 characters) allows end-of-shift remarks.

The confirmation button reads "Close Shift & Reconcile" and uses espresso fill with pearl text. On submission, call POST /api/shifts/[id]/close. On success, redirect the user to /dashboard/[tenantSlug] (the standard dashboard), since the POS terminal gate will block re-entry until a new shift is opened. Show a success toast before redirecting.

## Expected Output

- src/app/dashboard/[tenantSlug]/pos/layout.tsx as a server component with session validation, RBAC check, shift gate, and two-panel layout structure
- src/app/dashboard/[tenantSlug]/pos/page.tsx as a placeholder page that wires the ProductGrid and CartPanel into the two-panel slots
- src/components/pos/ShiftOpenModal.tsx as a client component with opening float input and Start Shift API call
- src/components/pos/ShiftCloseModal.tsx as a client component with closing cash count, discrepancy preview, and Close Shift API call

## Validation

- Navigating to /dashboard/[tenantSlug]/pos while unauthenticated redirects to the login page
- Navigating to /dashboard/[tenantSlug]/pos as a user without pos:access redirects to the dashboard home, not a 403 page
- Navigating to /dashboard/[tenantSlug]/pos as a cashier with no open shift renders the ShiftOpenModal fullscreen with no terminal content visible behind it
- Entering a valid opening float and clicking "Start Shift" creates a Shift record and reloads the terminal showing the full POS interface
- Navigating to /dashboard/[tenantSlug]/pos as a cashier with an active open shift loads the full terminal without the ShiftOpenModal
- The ShiftOpenModal has no dismiss mechanism — pressing Escape or clicking outside the card does nothing
- The Close Shift button in the top bar opens the ShiftCloseModal; successful closure redirects to the dashboard

## Notes

- The 100dvh height on the outermost container is deliberate. Using 100vh causes the layout to be clipped or cause overscroll on mobile browsers where the address bar appears and disappears. The dynamic viewport unit (dvh) accounts for this browser chrome correctly.
- The two-panel layout percentages (63/37) are intentional and informed by retail UX research: cashiers scan products quickly so the product area benefits from more space, while the cart panel needs enough width to display line items, quantities, and totals without truncation.
- The POS terminal intentionally has no breadcrumbs, no sidebar, and no back button. The cashier's context is singular: they are processing sales. Navigation to other areas of the dashboard is only available after closing the shift.
