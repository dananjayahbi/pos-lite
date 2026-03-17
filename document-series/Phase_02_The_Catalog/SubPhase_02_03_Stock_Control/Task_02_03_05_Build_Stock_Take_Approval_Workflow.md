# Task 02.03.05 — Build Stock Take Approval Workflow

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.05 |
| Task Name | Build Stock Take Approval Workflow |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | High |
| Dependencies | Task_02_03_04 complete |
| Output Path | src/app/dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/review/page.tsx |

---

## Objective

Build the Stock Take Approval review page at /dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/review. This interface is exclusively for users with the stock:take:approve permission (OWNER and MANAGER roles). The approver can review every variant count in the completed session, focus specifically on items with discrepancies, and either approve the session (which triggers bulk stock corrections across all discrepant variants) or reject it with a written reason (making no stock changes). The design must support confident, informed decision-making before irreversible stock corrections are applied.

---

## Instructions

### Step 1: Create the Route and Apply Strict Permission Guard

Create the review page at src/app/dashboard/[tenantSlug]/stock-control/stock-takes/[sessionId]/review/page.tsx. This route must enforce the stock:take:approve permission exclusively — unlike other pages in this sub-phase, this one must not fall back to a degraded view for lower-permission users.

If the authenticated user holds stock:take:manage but not stock:take:approve (i.e. a STOCK_CLERK who submitted the session), render a full-page confirmation card with a success icon, the message "Your stock take session has been submitted for approval", a submessage reading "A store manager will review your counts and apply corrections. You will be notified when a decision is made.", and a link "Return to Stock Takes" navigating back to the session list. This is not an error state — it is the expected post-submission experience for counting staff.

If the user lacks both permissions, render the standard permission-denied card.

### Step 2: Verify the Session is in PENDING_APPROVAL Status

After permission checking, verify the session retrieved by sessionId is in PENDING_APPROVAL status. If the session is IN_PROGRESS, redirect to the counting page at /stock-takes/[sessionId]. If the session is APPROVED or REJECTED, change the review page to a read-only historical summary mode — show the same interface but replace the approval decision panel with a "This session has already been [approved/rejected]" banner indicating the outcome and the actor who made the decision.

### Step 3: Render the Session Metadata Header

At the top of the review page, render a linen background card with a sand border. This card displays all key session metadata in a two-column label/value grid:

- Session ID: JetBrains Mono formatted identifier
- Scope: Category name or "All Categories"
- Started By: full display name and role of the initiating user
- Started At: full date and time
- Completed At: full date and time
- Total Items: count of all StockTakeItem records in the session
- Items with Discrepancies: count where discrepancy is not zero, displayed in warning amber if greater than zero

Below the metadata grid, render a page heading in Playfair Display: "Review Stock Take". Include a breadcrumb: Dashboard → Stock Control → Stock Takes → Review Session.

### Step 4: Render the Discrepancy Summary Card

Immediately below the metadata card, render a summary card whose visual treatment is conditional. If the session has zero discrepancies, the card uses a success-green left border and a light success background, and reads: "All X variants match system counts. No stock corrections are needed." If discrepancies exist, the card uses a warning-amber left border and a light amber background.

The warning-state summary card contains two key figures arranged side by side:

On the left: "X of Y variants have discrepancies." where X is the count of items with non-zero discrepancy. Below this, render two sub-lines showing the magnitude of positive and negative variances separately: "Additions: +A units across B items" and "Reductions: -C units across D items".

On the right: "Net variance: [+A / -C] units." The net figure is the algebraic sum of all discrepancies. Display the number in warning amber if absolute magnitude is greater than zero.

This summary card collapses to a single success line when all discrepancies are zero, keeping the page clean for sessions with no corrective action required.

### Step 5: Build the Three-Tab Item Review Interface

Below the summary card, render a ShadCN Tabs component with three tabs:

The first tab is labelled "All Items (X)" where X is the total item count. This tab contains the complete item table described in Step 6 with no filtering applied.

The second tab is labelled "Discrepancies (X)" where X is the discrepancy item count. It contains the same table structure but filtered to only rows where the discrepancy is non-zero. If X is greater than zero, this tab label renders in warning amber to draw the approver's attention. This is the tab that should be highlighted as the primary focus for the approver.

The third tab is labelled "Perfect Matches (X)" where X is the zero-discrepancy count. It contains the same table filtered to only rows where discrepancy equals zero.

All three tabs share the same table component with different data filters passed as props.

### Step 6: Build the Read-Only Review Table

The review table is entirely read-only — no inputs, no editing. It presents the data the counting staff entered alongside the system baseline. Columns:

The "SKU" column shows the variant SKU in JetBrains Mono.

The "Product" column shows the product name with its category in smaller muted text below.

The "Variant" column shows size and colour.

The "System Count" column shows the systemQuantity value in muted mist text. This was the database value at the moment the session was started.

The "Counted" column shows the countedQuantity value entered by counting staff, in bold Inter text.

The "Discrepancy" column shows the calculated difference. Zero renders as a muted "0" with a check mark icon in success green. Positive values render as "+X" in info blue. Negative values render as "-X" in danger red.

The "Recount" column shows whether the recount flag was set. If isRecounted is true, render a small warning amber flag icon with the tooltip "Marked for recount by staff". If false, render nothing.

The "Correction to Apply" column is only visible on the Discrepancies tab. It shows the stock adjustment that will be made if approved: "Add X units" in success text for positive discrepancies, or "Remove X units" in danger text for negative discrepancies. This column helps the approver quickly read what will happen to each variant if they click Approve.

### Step 7: Build the Sticky Approve and Reject Decision Panel

At the bottom of the page, render a sticky panel fixed to the bottom edge of the viewport. The panel uses a pearl background, a sand top border, and comfortable horizontal padding. It remains visible even when the approver is scrolled deep into a long item table.

The panel contains three elements arranged in a row:

On the left: a summary text reminding the approver of the consequences. If discrepancies exist: "Approving will apply X stock corrections across Y variants. This action cannot be undone." If no discrepancies: "Approving will confirm all counts with no stock changes required."

On the right: two buttons. The first is an espresso primary button labelled "Approve and Apply". The second is a danger-outline secondary button labelled "Reject Session".

Both buttons are disabled while the page data is still loading. While an approval or rejection API call is in progress, both buttons show a loading spinner and are disabled.

### Step 8: Build the Approval Confirmation Dialog

When the approver clicks "Approve and Apply", open a ShadCN Dialog before executing the API call. This dialog requires an explicit final confirmation to prevent accidental approvals.

The dialog title reads: "Confirm Approval". The body renders a numbered list of consequences:

1. "X stock corrections will be applied across Y variants."
2. "Variant stock levels in the database will be permanently updated."
3. "X StockMovement records will be created with reason STOCK_TAKE_ADJUSTMENT."
4. "This action cannot be undone."

Below the list, render a final confirmation note in muted text: "If you are unsure about any discrepancies, reject the session and request a recount."

The dialog footer has a ghost Cancel button and an espresso "Confirm Approval" button. Clicking Confirm calls POST /api/stock-takes/[id]/approve. On success: dismiss the dialog, show a Sonner toast "Stock take approved — X corrections applied." and navigate to the session list page. On API error: show a danger toast with the error message and leave the dialog open.

### Step 9: Build the Rejection Dialog

When the approver clicks "Reject Session", open a rejection ShadCN Dialog.

The dialog title reads: "Reject This Stock Take?". The body contains a description: "Rejecting will not change any stock quantities. The session will be marked as rejected and the counting staff will be notified. You can start a new stock take session at any time." Below, render a required textarea with label "Reason for Rejection (required)". The placeholder reads: "Explain why this session is being rejected, e.g. 'Significant discrepancies found in the Dresses category — please recount manually.'" The textarea has a 500 character limit with a live counter.

The Reject Confirm button is disabled until the reason textarea contains at least 20 characters. This prevents empty or meaninglessly short rejections. The footer has a ghost Cancel and a danger-filled "Reject Session" button. Clicking it calls POST /api/stock-takes/[id]/reject with the reason body.

On success: dismiss the dialog, show a Sonner toast "Stock take rejected. The counting staff has been notified." and navigate to the session list page.

### Step 10: Trigger Outcome Notifications

Both the approve and reject API endpoints (Task_02_03_09) already handle NotificationRecord creation server-side. On the UI side, after the navigation completes, TanStack Query's notification count query should be invalidated so the bell icon in the navigation bar reflects the latest unread count immediately.

---

## Expected Output

A fully functional stock take approval review page that allows authorised managers to evaluate counting sessions in detail by tab, read any discrepancies clearly, and either approve the session (triggering automatic bulk stock corrections) or reject it with a written reason. Both actions update session status, create notification records, and redirect the user to the session list.

---

## Validation

- Log in as a STOCK_CLERK and navigate directly to a PENDING_APPROVAL session's review URL. Confirm the "submitted for approval" confirmation card is shown, not the approval interface.
- Log in as a MANAGER. Navigate to the review page for a completed session with known discrepancies. Confirm the Discrepancies tab count matches the expected discrepant item count from the seed data.
- Verify the "Correction to Apply" column shows the correct direction and magnitude for both positive and negative discrepancies.
- Click "Approve and Apply". Confirm the dialog shows the correct correction count. Confirm approval. Verify that the stock levels in the database match the counted quantities from the session.
- On a second test session, click "Reject Session". Attempt to confirm without entering a reason — verify the button stays disabled. Enter a reason and reject. Verify no stock quantities change.
- Confirm that after approval, the session status is APPROVED in the session list and the Previously Submitted by actor receives a NotificationRecord.

---

## Notes

- The approval action is irreversible. Both the dialog warning copy and the sticky panel summary text must make this unambiguously clear. Do not soften the language.
- For sessions where all counts match (zero discrepancies), approval is still valid and should work without any stock adjustments being made. The API call is idempotent in this case — it transitions the session to APPROVED without calling bulkAdjustStock.
- The three-tab design ensures approvers are not overwhelmed by hundreds of matching items and can focus directly on the Discrepancies tab which is the primary decision surface.
- The sticky approval panel should have a sufficiently high z-index to appear above the table scroll area but below the sidebar and navigation bar.
