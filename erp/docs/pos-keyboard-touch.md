# POS input modes: touch, keyboard, and mouse

The POS terminal (`/pos`) is designed to work in all three cashier setups a shop
may actually deploy:

| Mode                | What the cashier uses                                     |
| ------------------- | --------------------------------------------------------- |
| Touch only          | Fingers on a tablet/touchscreen; no keyboard, no mouse.   |
| Keyboard only       | A barcode scanner plus the keyboard; no pointer at all.   |
| Mouse + keyboard    | The classic desktop flow.                                 |

All three share the same sale flow. The header exposes a **mode selector** so a
till can pick the layout that matches its hardware (see below).

## Choosing a profile

The POS toolbar has a segmented **Mouse & keyboard / Keyboard only** selector.
`Alt+M` toggles it from the keyboard, which matters because the keyboard-only
profile has no pointer targets that depend on a mouse.

| Profile | Layout |
| --- | --- |
| **Mouse & keyboard** (default) | Product grid, category tabs and the cart — the classic desktop and touch layout. |
| **Keyboard only** | A dedicated console: no product grid and no category tabs. A regular-size scan box with a keyboard-navigable match list, a page-wide ticket and a summary/actions rail. |

The choice is stored in `localStorage` under `ayurpos.pos.input-mode`
(`src/lib/pos/input-mode.ts`), so it survives reloads and applies to every tab on
that device. Switching profiles does not touch the cart or the open shift.

### The keyboard-only console

`src/components/pos/KeyboardPOSWorkspace.tsx` is a separate surface, not a CSS
variation of the grid:

- one always-focused scan box (`#pos-barcode-input`, still targeted by `F2` and
  every focus helper) at the same regular height as the grid's search field;
- scanner bursts and `Enter` resolve through the same barcode API/SKU rules as
  the grid;
- typing a name or SKU opens a capped match list above the ticket; `↑`/`↓` move
  the highlight and `Enter` adds the highlighted variant;
- the **added products (the ticket) fill the page-wide left column** via the
  shared `CartLineItems` component — the same list the classic cart renders, not
  a second summary. `↑`/`↓` move between lines, `+`/`-` change quantity and
  `Del` removes one;
- the right rail is summary-only: customer linking, discounts/promo, totals and
  the Charge / Pay button, with every shortcut unchanged (`F4`, `F8`, `F9`,
  `Alt+C`, `Alt+Shift+D`, …).

`CartPanel` takes `showLineItems={false}` for this layout, so the line items are
mounted exactly once (left) and the rail never repeats them.

Because the grid and categories are not mounted, there is no mouse-shaped
affordance in the keyboard path and the ticket gets the full screen width.

## The always-focused barcode box

`src/components/pos/POSScanInput.tsx` renders the single, always-ready barcode
and search field at the top of the product panel (`#pos-barcode-input`).

- It **auto-focuses** on mount and reclaims focus when the cashier taps a
  non-interactive part of the screen, returns to the tab, or closes a payment /
  receipt / customer dialog.
- Tapping a product card or other button does **not** steal the next scan: the
  input's focus guard only refocuses when nothing meaningful holds focus.
- It never steals focus from an open modal (`isPOSDialogOpen()`), so the payment
  amount field keeps its cursor.

Typing filters the product list exactly as before (200 ms debounce). Pressing
`Enter`:

1. matches an exact **SKU** or **barcode** among the products already on screen
   and adds that variant immediately (no API round trip), or
2. looks the code up through `/api/store/variants/barcode/[barcode]` when it is
   a valid barcode shape (`^[a-zA-Z0-9-]{8,20}$`), or
3. leaves ordinary search text in place so the list keeps filtering.

A keyboard-wedge burst (keystrokes ≤ 60 ms apart) is also flushed automatically
after 120 ms, which covers scanners that do not send a trailing Enter. Unknown
codes produce the same toasts as the global scanner path.

The legacy window-level `useBarcodeScanner` listener is still present as a
fallback for scans typed while focus sits outside a text field, but it defers to
the focused barcode box so a code is never added twice.

## Keyboard map

The in-app guide is available from the keyboard button in the POS toolbar or by
pressing `F1` / `?`. The same list lives in `POS_SHORTCUT_HELP`
(`src/lib/pos/keyboard.ts`), which the help dialog and unit tests share.

| Keys        | Action                                            |
| ----------- | ------------------------------------------------- |
| `F2`        | Focus the barcode / search box (`/` also works)   |
| `Alt + M`   | Switch mouse & keyboard ↔ keyboard-only layout    |
| `Alt + Enter` | Enter / exit fullscreen                         |
| `Enter`     | Add the scanned or searched product               |
| `← → ↑ ↓`   | Move between product cards, then cart rows        |
| `+` / `−`   | Increase / decrease the focused cart row quantity |
| `Delete`    | Remove the focused cart row                       |
| `F4`        | Open the payment method dialog (Charge / Pay; Zero-Value when due) |
| `Alt + Shift + D` | Show / hide discounts & promo          |
| `Alt + P`   | Expand discounts & focus the promo code           |
| `Alt + C`   | Focus the customer search                         |
| `Alt + A`   | Add a new customer                                |
| `Alt + U`   | Unlink the current customer                       |
| `F8`        | Hold the current sale                             |
| `F9`        | Retrieve a held sale                              |
| `F1` / `?`  | Show the shortcut guide                           |
| `Esc`       | Close a dialog / popover, or clear the search     |

Modal dialogs keep Radix's focus trap and `Esc` handling. The cash and card
payment dialogs submit with `Enter` as well as the button, so a sale can be
completed without leaving the keyboard.

### Fullscreen

The toolbar has a **fullscreen** button (`Maximize2` / `Minimize2`, next to the
shortcut guide). It calls the browser Fullscreen API on the document, so the
fitted POS shell fills the display without browser chrome. `Alt + Enter` toggles
it from the keyboard; the icon and `aria-pressed` state follow
`fullscreenchange`, so leaving with Esc or F11 stays in sync. If the browser or
an embedding policy blocks fullscreen, the action reports it with a toast and
leaves the terminal as-is.

### Modal-first actions

Actions that need more than one input open a dialog instead of an inline
control, so the barcode box never has to fight a popover for focus:

- **Charge / Pay (`F4`)** opens a payment-method dialog. `↑`/`↓` move between
  Cash, Card, LankaQR (when enabled) and Split; `Enter` picks one and `1`–`4`
  select directly. `Esc` closes it and returns to the barcode box.
- **Discounts & promo (`Alt + Shift + D`)** is one collapsible section holding
  both the manual cart discount and the promo-code field. It is collapsed by
  default so the line-item list gets the vertical space; expanding it focuses
  the discount amount, `Enter` applies, and `Esc` collapses it again. An applied
  promo code stays visible in the collapsed header.
- **Promo code (`Alt + P`)** expands the same section (if needed) and focuses
  the promo field. `Enter` applies the code, `Esc` cancels; both hand focus back
  to the barcode box, so the next scan lands in the right place.
- **Customer search (`Alt + C`)** stays a combobox: type a name or number, use
  `↑`/`↓` to highlight a result and `Enter` to link it. `Esc` closes the list
  and refocuses the scanner. `Alt + A` opens Add Customer and `Alt + U`
  unlinks the current customer.

The cart list is newest-first, so the product just scanned or added is always
the first row instead of appearing below the fold.

Printable shortcuts (`/`, `?`, `Alt+C`) are suppressed while a text field owns
the keystrokes; function keys (`F2`, `F4`, `F8`, `F9`) work even from the
barcode box because that is the cashier's default focus.

### Roving focus instead of a 30-stop tab path

- **Product grid:** one tab stop; arrow keys / `Home` / `End` move a roving
  `tabIndex` between cards. `Enter`/`Space` adds (or opens the variant dialog
  for multi-variant products) and returns focus to the scanner.
- **Category tabs:** one tab stop; `←`/`→` and `Home`/`End` move between
  categories.
- **Cart rows:** initial `Tab` enters the row; `↑`/`↓` move between rows, `+`/
  `−` change quantity, `Delete` removes, `Esc` closes the line editor.

## Touch behaviour

- Every POS action button has a ≥ 40 px hit area (toolbar actions and cart
  steppers are 40–44 px; Charge and Zero-Value are 48 px tall).
- Controls set `touch-action: manipulation` and suppress the tap highlight, so
  double-taps do not zoom and product cards do not select text.
- No interaction depends on hover; hover styles are additive only.
- Global `:focus-visible` outlines keep the active target visible for hybrid
  touch+keyboard devices.

## Verification

- `src/lib/pos/__tests__/keyboard.test.ts` covers shortcut normalization,
  editable-target detection, exact modifier matching, auto-repeat suppression,
  and that the documented shortcut list matches the implemented keys.
- `src/lib/pos/__tests__/input-mode.test.ts` covers parsing, persistence and the
  blocked-storage fallback for the input profile.
- `tests/43_pos_input_modes.spec.ts` switches profiles, checks the grid and
  categories disappear, verifies the scan box keeps its regular height, adds a
  product by keyboard, asserts the line appears once in the page-wide ticket
  (and never in the summary rail), reloads to prove persistence, and returns
  with `Alt+M`.
- `tests/45_pos_fullscreen.spec.ts` checks the toolbar toggle and `Alt+Enter`
  against a stubbed Fullscreen API (label/aria-pressed follow the event).
- `tests/14_pos_billing.spec.ts` — the full Module 14 suite (24 tests) passes
  against the seeded dev server. `C1`/`C5` cover scanner-style bursts entering
  the always-focused box, and `C8` covers the focus contract plus keyboard-only
  add → `F4` payment and Escape.
