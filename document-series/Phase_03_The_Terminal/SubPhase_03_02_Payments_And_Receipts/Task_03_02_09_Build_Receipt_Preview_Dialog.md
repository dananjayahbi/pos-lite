# Task 03.02.09 — Build Receipt Preview Dialog

## Metadata

| Field        | Value                                           |
|--------------|-------------------------------------------------|
| Sub-Phase    | 03.02 — Payments, Receipts and Offline Mode     |
| Phase        | 03 — The Terminal                               |
| Complexity   | Medium                                          |
| Dependencies | Task 03.02.07 (WhatsApp Dispatch), Task 03.02.08 (Thermal Receipt) |

---

## Objective

Build the `ReceiptPreviewDialog` component that appears immediately after a sale is successfully completed and gives the cashier a clear confirmation view along with options to send a WhatsApp receipt, print to the thermal printer, or dismiss without any receipt action.

---

## Instructions

### Step 1: Create the Component File

Create the file `src/app/[tenantSlug]/terminal/components/ReceiptPreviewDialog.tsx`. Define the TypeScript props interface for the component. The props are: `open` (boolean controlling visibility), `onClose` (void callback invoked when the dialog is dismissed without starting a new sale), `onNewSale` (void callback invoked when the cashier explicitly clicks "New Sale"), `completedSale` (the fully hydrated sale object returned by the `POST /api/sales` API response — may be null if the dialog is rendered before a sale is available, in which case the dialog should render nothing), `changeAmount` (a Decimal or null representing the calculated change due — only applicable for CASH and SPLIT payment methods), and `tenantSlug` (a string used to construct the receipt URL).

Import all required ShadCN `Dialog` sub-components: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and `DialogDescription`. Import the `Decimal` type from `decimal.js`. Import the project's currency formatter utility.

### Step 2: Dialog Shell

Use `ShadCN`'s `Dialog` with `open` controlled by the prop. Set `DialogContent` to `max-w-md`. This modal intentionally has no built-in close button on the top-right corner of the dialog — the cashier must make an explicit choice from among the options provided. Suppress the default close button by passing the appropriate ShadCN prop. Suppress backdrop and Escape key dismissal entirely for this dialog — the cashier should not accidentally dismiss the receipt options by pressing Escape or clicking outside. Only the explicit "No Receipt" link and the "New Sale" button close the dialog.

Apply a brief entrance animation. If the project uses Framer Motion for transitions, wrap the inner content in a motion container with a 150 ms fade-in. If not, use a simple CSS transition class.

### Step 3: Sale Complete Header

The first element inside the dialog body is the success confirmation header. Render a centred `<div>` containing a large Lucide `CheckCircle2` icon in the success green colour (`#2D6A4F`) at `size-12` or equivalent (48px). Below the icon, render the heading text "Sale Complete!" in Playfair Display using the project's heading font class, at a size of `text-2xl`, centred, in espresso colour.

This visual confirmation gives the cashier an immediate dopamine signal that the transaction succeeded. It is intentionally prominent because cashiers process many sales per hour and need instant confirmation without having to read fine detail.

### Step 4: Sale Summary Block

Below the header, render a summary block in a `linen`-background rounded container with `2px` solid `sand`-coloured border. The block contains three rows:

Row one: the label "Sale Ref" on the left and the first 8 characters of `completedSale.id` in uppercase on the right, rendered in JetBrains Mono font at `font-medium` weight.

Row two: the label "Total" on the left and the formatted total amount on the right, rendered in JetBrains Mono at `text-xl font-bold` in espresso colour.

Row three (conditional — render only if `changeAmount` is not null and the payment method is `CASH` or `SPLIT`): the label "Change Due" on the left and the formatted change amount on the right, rendered in JetBrains Mono at `text-xl font-bold` in success green (`#2D6A4F`). If the change amount is zero exactly, render "Rs. 0.00" in the normal espresso colour instead of success green — there is no need to highlight zero change.

### Step 5: WhatsApp Receipt Row

Below the summary block, render the WhatsApp receipt section. The section label reads "Send Receipt via WhatsApp" in a small muted mist-coloured style.

The WhatsApp row consists of a phone number input and a send button displayed side by side in a flex row. The phone input is a standard ShadCN `Input` with placeholder "e.g. 077 123 4567" and type "tel". Store the entered value in a `whatsappNumber` string state variable. The input has no autoFocus — the cashier may not always want to send a WhatsApp receipt, so do not pre-focus this field.

The "Send" button is a small outline variant button with the terracotta colour scheme. Its label is "Send" when idle, a loading spinner when the send request is in progress (use `isWhatsAppSending` boolean state), and "Sent ✓" with a muted success style for 3 seconds after a successful dispatch (use `whatsappSent` boolean state with a `setTimeout` to reset it). Disable the send button when the input is empty, when `isWhatsAppSending` is true, or when `whatsappSent` is true. Do not disable the input itself during or after sending — the cashier may want to correct the number and send again.

On clicking "Send", set `isWhatsAppSending` to true and call `POST /api/sales/[completedSale.id]/send-receipt` with the `phoneNumber` field set to the current `whatsappNumber` value. On a successful API response where `response.success` is true, set `isWhatsAppSending` to false and `whatsappSent` to true, then show a brief success toast "Receipt sent via WhatsApp." On a response where `response.success` is false, set `isWhatsAppSending` to false and set `whatsappErrorMessage` to the error string from the response (see Step 6).

### Step 6: WhatsApp Error State

Maintain a `whatsappErrorMessage` string or null state variable. When non-null, render an error panel directly below the WhatsApp row. The panel has a `danger`-coloured left border and a `linen` background. Its content is two elements: a small "Receipt not sent" label in danger red and the `whatsappErrorMessage` text in a small body style. Below the error text, render a "Retry" link (plain `<button>` styled as text) that resets `whatsappErrorMessage` to null and `whatsappSent` to false so the cashier can attempt again. The retry action does not pre-fill the number with any correction — the cashier simply clicks the "Send" button again.

### Step 7: Print Button

Below the WhatsApp section, render the Print Receipt button as a secondary full-width ShadCN `Button` with an `outline` variant and the sand/terracotta scheme. Its label is "Print Receipt" with a Lucide `Printer` icon on the left. Clicking this button constructs the receipt URL as `/api/sales/[completedSale.id]/receipt` using the `tenantSlug` if the route requires it, and calls `window.open(url, "_blank", "noopener")` to open the receipt in a new browser tab. The new tab renders the thermal receipt HTML and triggers the browser's print dialog automatically via the embedded `setTimeout(window.print, 200)` script.

The print button is never disabled, never shows a loading state, and never provides error feedback. Opening a new tab is instantaneous from the user's perspective. If the receipt URL fails to load (e.g. the sale cannot be found), the new tab will display the "Receipt not found" HTML page from the receipt route handler — the dialog itself is unaffected.

### Step 8: No Receipt Link and New Sale Button

Below the print button, render two more controls separated by a small visual gap.

The "No Receipt" element is a plain text link rendered as a `<button>` with minimal text styling (`text-sm text-muted-foreground underline-offset-2 hover:underline`). Its label is "No Receipt — close". Clicking it invokes `onClose` and the dialog closes without starting a new sale. The cashier would then manually use the POS terminal's "New Sale" control. This option exists so the cashier can close the receipt dialog without clearing the cart in cases where they want to review the last-completed sale data briefly.

The "New Sale" button is a primary full-width ShadCN `Button` with the espresso background and pearl text, matching the primary action style from the design system. Its label is "New Sale" with a Lucide `Plus` icon. Clicking it invokes `onNewSale`. The parent terminal component's `onNewSale` handler is responsible for resetting the Zustand cart store to its empty initial state, clearing any held-sale references, and closing the dialog. The dialog itself does not manage cart state.

### Step 9: Keyboard Navigation and Accessibility

Ensure the dialog is keyboard-navigable. Tab order should flow: WhatsApp phone input → Send button → Print Receipt button → No Receipt → New Sale. Apply explicit `tabIndex` props if the default tab order from DOM position deviates from this intended flow. The "Sale Complete!" heading should be the focus target when the dialog opens — apply `autoFocus` to the heading container or use a `useEffect` with `elementRef.current.focus()` to set programmatic focus on mount.

Add `aria-label` attributes to any icon-only buttons. Ensure the dialog has a meaningful `aria-labelledby` attribute pointing to the "Sale Complete!" `DialogTitle` element so screen readers announce the dialog purpose on open.

---

## Expected Output

- `src/app/[tenantSlug]/terminal/components/ReceiptPreviewDialog.tsx` created and wired into the terminal page's `onSaleComplete` callback.
- The dialog appears after every successful sale, showing the correct total, change (if applicable), and offering WhatsApp and print actions.
- Closing the dialog via "New Sale" triggers cart reset in the parent; "No Receipt" closes the dialog without resetting the cart.

---

## Validation

- Complete a cash sale on the POS terminal and confirm the dialog appears with the correct total and change amount.
- Complete a card sale and confirm the change row is absent.
- Complete a split sale and confirm the change row shows the change on the cash leg.
- Enter a valid Sri Lankan mobile number in the WhatsApp input and click "Send" — confirm the `POST /api/sales/[id]/send-receipt` network request is made and the "Sent ✓" state appears on success.
- Simulate a WhatsApp send failure (by entering an invalid number or temporarily removing the `WHATSAPP_ACCESS_TOKEN` env var) and confirm the error panel appears with a retry option.
- Click "Print Receipt" — confirm a new browser tab opens and the thermal receipt HTML renders with the print dialog.
- Click "No Receipt — close" and confirm the dialog closes without the cart being cleared.
- Click "New Sale" and confirm the terminal cart resets to empty.
- Tab through the interactive elements in the dialog and confirm the order matches the intended flow.

---

## Notes

- The "Sent ✓" transient state uses a `setTimeout` of 3000 ms to reset `whatsappSent` back to false. If the cashier needs to send to a second number after those 3 seconds have elapsed, the button is re-enabled automatically. This prevents a scenario where only one WhatsApp send is possible per sale — multiple sends to different numbers must be supported (e.g., sending to both the customer and the store owner).
- The `window.open` call for the print action uses the `"noopener"` feature flag as a security best practice to prevent the opened tab from accessing the opener window's JavaScript context. This satisfies OWASP A01 (Broken Access Control) requirements for tab opener isolation.
- The `onNewSale` callback must reset the cart in the Zustand store AND clear the `usePersistCartEffect` IndexedDB entry so that the next terminal session starts clean. Coordinate this with the implementation in Task 03.02.11.
- Do not display the full sale UUID in the receipt dialog. The 8-character uppercase reference is sufficient for cashier identification and avoids exposing internal database identifiers in a customer-facing context.
