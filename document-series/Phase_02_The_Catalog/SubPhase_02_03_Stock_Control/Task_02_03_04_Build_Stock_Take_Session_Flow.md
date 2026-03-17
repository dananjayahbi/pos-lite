# Task 02.03.04 — Build Stock Take Session Flow

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.04 |
| Task Name | Build Stock Take Session Flow |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | High |
| Dependencies | Task_02_03_01 complete |
| Output Paths | src/app/dashboard/[tenantSlug]/stock-control/stock-takes/page.tsx, src/app/dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/page.tsx |

---

## Objective

Build the Stock Take session management area covering two views: the Session List page at /stock-control/stock-takes and the Active Session counting interface at /stock-control/stock-takes/[sessionId]. Together, these views allow authorised staff to create a new stock take session scoped to all products or a specific category, enter physical counts for every variant in scope, flag items that need recounting, and submit the completed session for management approval. The design must accommodate a physical barcode scanner as the primary input device for the counting interface, with keyboard-only fallback.

---

## Instructions

### Step 1: Create the Route Structure

Create the directory layout src/app/dashboard/[tenantSlug]/stock-control/stock-takes/ with a page.tsx for the session list and a nested [sessionId]/ directory containing another page.tsx for the counting interface. Both pages require the stock:take:manage permission. Gate both with an inline permission-denied card as done in previous tasks.

### Step 2: Build the Session List Page Header

On the Session List page, render an H1 in Playfair Display: "Stock Takes". Place a "Start New Stock Take" primary button (espresso style) at the top right of the heading row. Below the heading, render a muted subtitle: "Conduct periodic inventory counts and apply variance corrections to your stock levels."

Include a breadcrumb: Dashboard → Stock Control → Stock Takes.

### Step 3: Build the Session List Table

Fetch all StockTakeSession records for the tenant ordered by startedAt descending using TanStack Query. Render the sessions in a ShadCN Table with sand-coloured header row. Columns:

The "Session ID" column shows a truncated identifier (first 8 characters) in JetBrains Mono font, formatted as a monospaced short code for visual scanning.

The "Scope" column shows the category name if the session was scoped to a category, or "All Categories" in italic muted text if the session covered the full catalog.

The "Status" column shows a colour-coded badge. IN_PROGRESS uses the info semantic colour with a pulsing dot indicator to signal an active session. PENDING_APPROVAL uses the warning semantic colour. APPROVED uses the success semantic colour. REJECTED uses a neutral muted grey rather than the danger red — rejected sessions are a normal part of the workflow and should not alarm users viewing the history list.

The "Started By" column shows the initiating user's display name.

The "Started At" column shows the start timestamp in the standard "15 Jan 2025, 2:34 PM" format.

The "Completed At" column shows the completion timestamp or a muted dash if the session is still in progress.

The "Discrepancies" column shows the count of StockTakeItem records with a non-zero discrepancy. This is only populated after the session has been completed — for IN_PROGRESS sessions, show a muted dash. For APPROVED and REJECTED sessions, render the count with a warning badge if greater than zero.

The "Actions" column renders contextually based on status. For IN_PROGRESS sessions, render a "Continue Counting" button linking to the session's counting page. For PENDING_APPROVAL sessions, render a "Review" button linking to the approval page at /stock-takes/[sessionId]/review (only visible to users with stock:take:approve permission — for others, show "Awaiting Approval" in muted text). For APPROVED or REJECTED sessions, render a "View Details" button.

### Step 4: Enforce Single Active Session Constraint

The "Start New Stock Take" button must check whether any IN_PROGRESS session already exists for the tenant before opening the creation dialog. If one exists, the button is replaced with a warning banner that reads: "A stock take session is currently in progress. Complete or abandon it before starting a new one." and includes a "Continue Current Session →" link to the active session. The button should not be disabled silently — the user must understand why a new session cannot be started.

### Step 5: Build the Session Creation Dialog

When the "Start New Stock Take" button is clicked (and no session is in progress), open a ShadCN Dialog with the title "Start New Stock Take Session".

The dialog contains a scope selector section with two options presented as radio cards side by side:

The first option is "All Products". A description reads: "Count every active variant in your catalog. Recommended for a full periodic inventory." Selecting this option does not require additional input.

The second option is "Specific Category". A description reads: "Count only the variants in one product category." Selecting this option reveals a ShadCN Select dropdown below it, populated with all active non-deleted categories for the tenant. The dropdown label is "Select Category" and it is required when this option is chosen.

Below the scope options, render a warning note box with a caution icon in warning-amber colour: "This will capture the current stock quantities as the session baseline. Make sure all pending manual adjustments are complete before starting."

The dialog footer has two buttons: a ghost "Cancel" button and an espresso "Start Session" primary button. The Start Session button is disabled until either the All Products option is selected or a category is selected from the dropdown. Clicking it calls POST /api/stock-takes, shows a loading spinner in the button, and on success redirects the user to the newly created session's counting page.

### Step 6: Build the Active Session Counting Interface Header

On the Active Session page at /stock-control/stock-takes/[sessionId], fetch the full session record with its items using TanStack Query. Render the session status at the very top with the pulsing blue IN_PROGRESS badge.

The session header card (linen background, sand border) shows: the session scope (category name or "All Categories"), the start date and time, the number of variants counted so far versus the total variants in the session, and a horizontal progress bar. The progress bar fill advances as countedQuantity values are entered for each item. The filled portion uses the success green colour; the empty portion uses the mist colour.

Include a sticky header behaviour so the progress bar and key session stats remain visible as the user scrolls through a large variant list.

### Step 7: Build the Barcode Scan Input

At the top of the page, below the session header, render a prominent scan input area. This is a large text input with an auto-focus attribute set so that when a barcode scanner fires, the input already has keyboard focus. Include a barcode icon to the left of the input. The placeholder text reads: "Scan barcode or type SKU to locate a variant".

The input listens for any text followed by an Enter key press (the standard output of a USB barcode scanner). On submission: look through the session's item list for a variant whose barcode or SKU matches the scanned value exactly.

If a match is found: scroll the matching item row into view, briefly highlight it with a sand-coloured pulse animation, and place focus in that row's counted quantity input so the user can immediately type the count.

If no match is found: display a small red alert message beneath the scan input reading: "No variant found with barcode or SKU '[value]'. Check the barcode or contact your manager." This message auto-dismisses after 4 seconds.

Clear the scan input after each search (successful or not) so it is ready for the next scan.

### Step 8: Build the Variant Counting Table

Below the scan input, render the full list of session items in a ShadCN Table. For large sessions (more than 50 items), implement virtual scrolling or a paginated table with 25 items per page. The table header uses sand background.

Columns from left to right:

The "SKU" column shows the variant SKU in JetBrains Mono font. This value is the primary identifier during physical counting.

The "Product" column shows the product name. Below the product name in smaller muted text, show the category.

The "Variant" column shows the size and colour identifiers formatted as "M / Black" or "One Size / White".

The "System Count" column shows the systemQuantity value captured when the session was created. This value is read-only and rendered in mist-coloured text to make it visually secondary — it represents what the system believes the stock to be, not what was physically counted.

The "Counted" column contains an editable number input for each row. The input starts empty until the user enters a value. The minimum allowed value is 0. The input accepts only whole numbers. When the user tabs away from or blurs the input, the value is auto-saved: a PATCH /api/stock-takes/[id]/items/[itemId] request is sent immediately. A brief "Saved" confirmation check mark icon appears beside the input for 1.5 seconds after a successful save.

The "Discrepancy" column shows the difference between countedQuantity and systemQuantity: discrepancy = countedQuantity minus systemQuantity. This column renders as a dash while countedQuantity is still empty. Once entered: zero discrepancy renders as "0" in success green with a check mark icon. Positive discrepancy renders as "+X" in info blue. Negative discrepancy renders as "-X" in danger red.

The "Recount" column contains a toggle switch per row. When activated, the row is visually flagged with a thin warning-amber left border. This flag indicates to supervisors that a second person should verify this item's count. Toggling writes immediately to the backend via the same PATCH endpoint.

### Step 9: Implement Auto-Save for Session Progress

Beyond the per-row auto-save on blur described above, implement a background auto-save interval using setInterval in a useEffect that fires every 60 seconds. The interval saves all rows whose countedQuantity has changed since the last save but where the user may not have explicitly blurred the field. This protects against accidental browser close or session timeout. Display a small "Last saved X seconds ago" status line at the bottom of the page, updating every second.

A "Save Progress" button is also available for manual saves, rendered in a secondary outlined style. Clicking it immediately triggers a save of any unsaved changes and updates the "last saved" timestamp.

### Step 10: Build the Complete Session Flow

The "Complete Session" button is rendered at the bottom of the page in the espresso primary style and at the top of the page in a secondary outlined style (both visible). It is disabled while any countedQuantity field is still empty.

When clicked, validate that all session items have a non-null countedQuantity. If any are missing, do not open the confirmation dialog. Instead, highlight each incomplete row with a danger-red border on its counted input and scroll to the first incomplete row. Show a toast: "X variants still need a count before the session can be completed."

When all items are counted, open a ShadCN Dialog with title "Complete Stock Take Session?". Inside, show a confirmation summary with three data points: "X items counted", "Y items with discrepancies", and "Net total variance: +A / -B units". Below the summary, render a note in muted text: "Completing the session will submit it for manager approval. No stock changes will be made until an authorised manager approves the session." The dialog has a ghost Cancel button and an espresso "Complete & Submit for Approval" button. Clicking confirm calls POST /api/stock-takes/[id]/complete. On success, redirect to the session list page and show a toast: "Session submitted for approval. A manager will review your counts."

---

## Expected Output

A working Stock Take session list page and a fully functional active session counting interface. Staff can create a session, scan or look up variants, enter counts, see live discrepancy calculations, and submit for approval. The interface is optimised for barcode scanner workflows and handles large variant lists without performance degradation.

---

## Validation

- Navigate to /dashboard/dev-store/stock-control/stock-takes and confirm the session list renders correctly with all seeded sessions (if any).
- Click "Start New Stock Take", select "Specific Category", choose the "Dresses" category, and start the session. Confirm the redirect lands on the new session page with all dress variants pre-populated with their systemQuantity values.
- Simulate a barcode scan by typing a known SKU in the scan input and pressing Enter. Confirm the matching row is highlighted and focused.
- Enter counted quantities for all but one variant. Attempt to click "Complete Session". Confirm the incomplete row is highlighted and scroll is directed to it.
- Complete all counts and submit the session. Confirm it transitions to PENDING_APPROVAL status in the session list.
- Attempt to start a second session while the first is IN_PROGRESS. Confirm the warning banner appears and the Start button is suppressed.

---

## Notes

- Barcode scanner hardware typically sends characters as rapid keyboard input followed by an Enter key. The scan input must not strip or debounce individual characters — it should accumulate the entire scanned string and only trigger the search on Enter.
- For sessions with many hundreds of variants (full-catalog stock takes on a large clothing store), the counting table should use a virtualised list to maintain scrolling performance. React Virtual or a ShadCN-compatible virtual list can be used.
- The discrepancy column intentionally renders nothing while countedQuantity is still empty. Showing a discrepancy before a count is entered (which would always be -systemQuantity) would be confusing and alarming to staff who have not yet counted that item.
- The auto-save per row on blur is the critical data protection mechanism. The 60-second interval is a secondary safety net. Do not allow more than 60 seconds of unsaved counted data to be at risk at any time.
