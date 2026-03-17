# Task 01.02.08 — Implement Auto Logout Screen Lock

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_04 (PinEntryModal component must exist)

---

## Objective

Implement the auto-logout inactivity timer system with a configurable timeout hook, a full-viewport ScreenLockOverlay component that preserves the POS cart state, and integration into the (store) layout so every protected page is covered automatically.

---

## Instructions

### Step 1: Understand the Locking Architecture

The screen lock system has three key design constraints that guide all implementation decisions:

First, the cart state must be preserved. When the screen locks, the cashier's in-progress sale (stored in the Zustand cartStore) must remain entirely intact. The lock does not sign the user out — it merely prevents interaction until the PIN is re-entered. A full sign-out is a separate action triggered by the cashier explicitly from the menu.

Second, navigation must be blocked. While the screen is locked, the user should not be able to click any navigation link, button, or interactive element beneath the overlay. The overlay must sit above all other UI in the z-order.

Third, the timer resets on any user activity. The timeout clock restarts whenever the user performs any interaction detectable by the browser, including mouse movement, keyboard input, touch events, and clicks.

### Step 2: Plan the Zustand UI Store

Before building the hook, confirm the structure of the uiStore in src/store/uiStore.ts (created in SubPhase 01.01 when Zustand was set up). The uiStore should expose a isScreenLocked boolean state and two actions: lockScreen() (sets isScreenLocked to true) and unlockScreen() (sets isScreenLocked to false). If the uiStore does not yet have these fields, add them now. The initial value of isScreenLocked is false.

### Step 3: Create the useInactivityTimer Hook

Create the file src/hooks/useInactivityTimer.ts as a client-side hook. The hook accepts a single optional parameter: timeoutMs, the inactivity duration in milliseconds before the screen locks. The default value should be 10 minutes expressed as the number 600000 (10 multiplied by 60 multiplied by 1000). In the future this value will be read from tenant settings, but for now the default is used.

The hook uses a useRef to store the setTimeout timer ID so it can be cancelled and restarted without causing unnecessary re-renders. Inside a useEffect, register event listeners on the document object for the following events: mousemove, keydown, touchstart, and click. Each event listener should call a resetTimer function. The cleanup function of the useEffect should remove all event listeners and clear the pending timer.

The resetTimer function clears any existing timer using clearTimeout, then sets a new timer using setTimeout. When the timer fires, it calls the lockScreen action from the uiStore.

The hook should also expose a resetTimer function as a return value so that callers can manually reset the timer (for example, after the screen is unlocked, to start the countdown fresh from the moment the PIN is entered).

### Step 4: Create the ScreenLockOverlay Component

Create the file src/components/shared/ScreenLockOverlay.tsx as a Client Component. The component reads isScreenLocked from the uiStore. When isScreenLocked is false, the component renders null (nothing). When isScreenLocked is true, the component renders a fixed-position full-viewport overlay.

The overlay styling should use a fixed position element with inset 0 (covering the full viewport), a high z-index value (for example 9999) to sit above all other content, and a semi-transparent background — the espresso color at approximately 90 percent opacity (--color-espresso with an opacity modifier) — so the underlying POS terminal is faintly visible through the lock screen, reinforcing that the session is locked, not terminated.

Inside the overlay, center a lock panel card using flex centering. The card uses a linen background (--color-linen), a mist border (--color-mist), rounded corners, and generous padding. At the top of the card, display a lock icon (from Lucide React or a simple SVG), the text "Screen Locked" in Playfair Display font and espresso color, and below it in Inter the current user's display name and role (read from the useSession hook). Below this header, render the PinEntryModal component in non-overlay mode (isOverlay: false, or simply embed the numpad inline within the card), passing the current session user's email as the userEmail prop and an onSuccess callback.

The onSuccess callback should: call unlockScreen() from the uiStore, call the resetTimer function from the useInactivityTimer hook (to start the countdown fresh), and optionally trigger a session refresh with the update function from useSession to ensure the JWT is still valid.

Include a secondary link below the numpad reading "Sign out instead" that calls signOut from next-auth/react. This gives the cashier an escape route if they want to fully log out rather than unlock.

### Step 5: Integrate into the Store Layout

Open the (store) route group's layout file at src/app/(store)/layout.tsx. Import and render the ScreenLockOverlay component and the useInactivityTimer hook. Because the layout is a Server Component by default, this integration requires extracting the parts that use the hook and overlay into a separate Client Component — for example, a component named StoreLayoutClient. The Server Component layout renders the main shell (sidebar, header, main content slot) and includes the StoreLayoutClient as a child or sibling. The StoreLayoutClient mounts the ScreenLockOverlay and calls useInactivityTimer, wiring the auto-lock behavior to the entire (store) application surface.

### Step 6: Handle Edge Cases

Consider the following edge cases and ensure the implementation handles them correctly:

If the user has the PIS terminal open in multiple tabs, each tab has an independent inactivity timer. This is acceptable behavior — locking one tab does not lock others.

If the timer fires during an active API request or while a dialog is open, the overlay should still appear. Interactive elements beneath the overlay must be unreachable regardless of their own z-index values. Apply pointer-events: none to all content beneath the overlay, or rely on the overlay's own click-blocking behavior from its fixed positioning on top.

If the session has actually expired (Auth.js JWT expiry) when the PIN is entered, the PIN verification will succeed locally but the subsequent session refresh may fail. In this case, call signOut and redirect to /login instead of unlocking.

### Step 7: Test the Screen Lock Behavior

Verify the following scenarios manually during development:

Open the POS page with items in the cart. Wait 10 minutes (or temporarily reduce the timeout to 5 seconds for testing). Confirm the overlay appears. Enter the correct PIN. Confirm the overlay disappears and the cart items are still present.

Move the mouse. Confirm that the inactivity timer resets (the lock does not appear within 10 minutes when the user is actively moving the mouse).

With the screen locked, attempt to click a navigation link visible behind the semi-transparent overlay. Confirm no navigation occurs.

Click "Sign out instead" from the lock screen. Confirm a full signOut is performed and the user is redirected to /login.

---

## Expected Output

- src/hooks/useInactivityTimer.ts sets up a resettable 10-minute inactivity timer that calls lockScreen on expiry
- src/components/shared/ScreenLockOverlay.tsx renders a full-viewport espresso overlay with embedded PinEntryModal
- The uiStore exposes isScreenLocked, lockScreen, and unlockScreen
- The overlay blocks all interaction beneath it while visible
- Successful PIN entry unlocks the screen and resets the inactivity timer
- The active Zustand cartStore state is fully preserved through the lock/unlock cycle
- The ScreenLockOverlay is integrated into the (store) layout via a StoreLayoutClient wrapper

---

## Validation

- [ ] After the configured timeout with no user activity, the ScreenLockOverlay appears
- [ ] Any mouse movement or key press within the timeout period resets the timer
- [ ] The overlay renders with the correct espresso semi-transparent background
- [ ] The current user's name and role are displayed on the lock screen
- [ ] Entering the correct PIN calls unlockScreen and dismisses the overlay
- [ ] Entering an incorrect PIN shows "Incorrect PIN" and keeps the overlay visible
- [ ] The POS cart contents are identical before and after a lock/unlock cycle
- [ ] Clicking UI elements behind the overlay does not trigger any interaction
- [ ] "Sign out instead" on the lock screen calls signOut and redirects to /login
- [ ] pnpm tsc --noEmit passes without errors in all new and modified files

---

## Notes

- The inactivity timer hook must clean up its event listeners on component unmount. Failing to do so causes memory leaks and ghost timers that continue firing after the component is gone. Confirm the useEffect cleanup function removes all registered listeners and calls clearTimeout.
- The timer default is 10 minutes but will be made tenant-configurable in Phase 3 Store Settings. Design the hook to accept the timeout value as a parameter from the start, even if the parameter is currently hard-coded at the call site.
- Do not use a global window.addEventListener for the inactivity events — use document.addEventListener instead. This ensures touch events on scrollable inner elements are also captured. Include the passive: true option on the touchstart listener for performance.
- The overlay component intentionally uses 90% opacity rather than full opacity on the espresso background. This subtle bleed-through of the underlying UI is a UX decision that reassures cashiers they have not accidentally logged out and lost their cart.
- The z-index of 9999 works for most cases but may conflict with tooltip libraries or modal managers that also use very high z-index values. If such a conflict is discovered in Phase 2 POS development, increase the overlay z-index or use a CSS layer strategy to ensure the lock screen always wins.
