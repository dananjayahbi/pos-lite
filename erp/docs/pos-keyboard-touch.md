# POS input modes: touch, keyboard, and mouse

The POS terminal (`/pos`) is designed to work in all three cashier setups a shop
may actually deploy:

| Mode                | What the cashier uses                                     |
| ------------------- | --------------------------------------------------------- |
| Touch only          | Fingers on a tablet/touchscreen; no keyboard, no mouse.   |
| Keyboard only       | A barcode scanner plus the keyboard; no pointer at all.   |
| Mouse + keyboard    | The classic desktop flow.                                 |

All three share the same surface — there is no separate "touch mode" toggle.

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
| `Enter`     | Add the scanned or searched product               |
| `← → ↑ ↓`   | Move between product cards, then cart rows        |
| `+` / `−`   | Increase / decrease the focused cart row quantity |
| `Delete`    | Remove the focused cart row                       |
| `F4`        | Open payment (Charge / Pay; Zero-Value when due)  |
| `F8`        | Hold the current sale                             |
| `F9`        | Retrieve a held sale                              |
| `Alt + C`   | Focus the customer search                         |
| `F1` / `?`  | Show the shortcut guide                           |
| `Esc`       | Close a dialog / popover, or clear the search     |

Modal dialogs keep Radix's focus trap and `Esc` handling. The cash and card
payment dialogs submit with `Enter` as well as the button, so a sale can be
completed without leaving the keyboard.

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
- `tests/14_pos_billing.spec.ts` — the full Module 14 suite (23 tests) passes
  against the seeded dev server. `C1`/`C5` cover scanner-style bursts entering
  the always-focused box, and `C8` covers the focus contract plus keyboard-only
  add → `F4` payment and Escape.
