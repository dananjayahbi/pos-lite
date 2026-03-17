# Task 03.02.11 — Implement Offline Mode Cart Persistence

## Metadata

| Field        | Value                                          |
|--------------|------------------------------------------------|
| Sub-Phase    | 03.02 — Payments, Receipts and Offline Mode    |
| Phase        | 03 — The Terminal                              |
| Complexity   | High                                           |
| Dependencies | Task 03.02.06 (Sale API Routes), SubPhase 03.01 complete |

---

## Objective

Implement two complementary React hooks that together ensure the POS terminal operates gracefully during network disruptions: `usePersistCartEffect` continuously snapshots the cashier's in-progress cart to IndexedDB so it survives page refreshes, and `useOfflineSync` detects loss of connectivity, holds any pending sale submission in IndexedDB, and automatically replays it when the network recovers.

---

## Instructions

### Step 1: Install the idb Library

The `idb` library provides a clean Promise-based TypeScript-typed wrapper around the browser's IndexedDB API. From the project root in a terminal, run `pnpm add idb`. Confirm the installation by verifying that `idb` appears in `package.json` under `dependencies` and that `node_modules/idb` exists.

Do not use the raw `indexedDB` browser API directly anywhere in the hooks — always go through the `idb` wrapper. The raw API is callback-based and error-prone; the `idb` wrapper translates it into `async/await`-compatible Promises and provides TypeScript generics for value types.

### Step 2: Create the IndexedDB Store Module

Create the file `src/lib/idb-store.ts`. This module is the single place in the codebase that opens the IndexedDB database and manages schema upgrades. Nothing else should call `openDB` from `idb` directly; all read and write operations in the hooks go through functions exported from this module.

At the top of the file, define the database name as a constant: `"velvetpos_offline_db"`. Define two object store names as constants: `"cart_persist"` for the cart snapshot store and `"sale_queue"` for the pending sale queue store.

Implement and export the function `getOfflineDB`. It is an async function that calls `openDB` from `idb` with the database name, version number `1`, and an `upgrade` callback. Inside the `upgrade` function, check whether the `"cart_persist"` object store exists using `db.objectStoreNames.contains(...)` and create it if absent — with `keyPath: "storeKey"`. Do the same for `"sale_queue"` — also with `keyPath: "id"` using a native auto-incrementing key (`autoIncrement: true`). The upgrade function must be idempotent: creating an already-existing object store throws in IndexedDB, so the existence check is non-negotiable.

Implement and export four thin helper functions that wrap common operations:
- `saveCartSnapshot(storeKey: string, cartData: unknown): Promise<void>` — opens the DB, puts an object `{ storeKey, data: cartData, savedAt: Date.toISOString() }` into the `"cart_persist"` store.
- `loadCartSnapshot(storeKey: string): Promise<unknown | null>` — opens the DB, gets the record by `storeKey` from `"cart_persist"`, and returns `record.data` if found, or `null` if `undefined`.
- `clearCartSnapshot(storeKey: string): Promise<void>` — opens the DB, deletes the record by `storeKey` from `"cart_persist"`.
- `enqueueOfflineSale(payload: unknown): Promise<number>` — opens the DB, adds an object `{ payload, queuedAt: Date.toISOString() }` to `"sale_queue"` and returns the generated numeric key.
- `getQueuedSale(): Promise<{ key: number; payload: unknown; queuedAt: string } | null>` — opens the DB, reads all keys from `"sale_queue"`, takes the first one (lowest key = oldest queued sale), retrieves and returns the full record, or returns `null` if the queue is empty.
- `dequeueOfflineSale(key: number): Promise<void>` — opens the DB, deletes the record by numeric key from `"sale_queue"`.

Export all six helper functions plus the two store name constants from this module.

### Step 3: Implement usePersistCartEffect

Create the file `src/app/[tenantSlug]/terminal/hooks/usePersistCartEffect.ts`.

The hook accepts two parameters: `cartState` (the current full cart state object from the Zustand cart store — typed with the project's `CartState` type) and `tenantSlug` (the string used to namespace the cart key per tenant).

The IndexedDB key is constructed by concatenating the string `"velvetpos_cart_"` with the `tenantSlug` value. This namespacing ensures that if the same browser session is used for multiple tenant tabs (unlikely in production but plausible in development), each tenant's cart is stored and restored independently without collision.

The hook contains two `useEffect` calls.

The first `useEffect` handles cart saving. It runs whenever `cartState` or `tenantSlug` changes. Inside the effect, if `cartState` is empty (defined as: the cart items array has zero elements), call `clearCartSnapshot` with the constructed key — clearing an empty cart prevents stale data from being restored after a cashier intentionally starts a new sale. If `cartState` is non-empty, call `saveCartSnapshot` with the key and the serialised cart state. Both calls are async and must be awaited inside an IIFE (`async () => { await ... })()`) because `useEffect` callbacks cannot be async themselves. Errors from either call are caught and logged to `console.warn` — a cart persistence failure should never crash the POS terminal or surface an error modal. Cart persistence is a best-effort enhancement; the lack of it is inconvenient but not catastrophic.

The second `useEffect` handles cart restoration. It runs exactly once on mount (empty dependency array). Inside, it calls `loadCartSnapshot` with the key. If a non-null result is returned, it calls the Zustand cart store's `restoreCart` action (which must be implemented in the cart store as part of SubPhase 03.01, or added now if it was deferred) with the loaded snapshot. Wrap the load and restore in an async IIFE. As with saving, errors are caught and logged to `console.warn` — a failed restoration means the cashier starts with an empty cart, which is acceptable.

The hook returns nothing. It is used purely for its side effects and has no return value.

### Step 4: Implement useOfflineSync

Create the file `src/app/[tenantSlug]/terminal/hooks/useOfflineSync.ts`.

The hook accepts one parameter: `tenantSlug` (string), used in the `OFFLINE_STALE_HOURS` annotation and for namespacing logs.

The hook returns an object with four fields: `isOnline` (boolean), `isSyncing` (boolean — true while a queued sale is being submitted), `hasPendingSale` (boolean — true if there is one sale in the queue), and `syncError` (string or null — the error message if the last sync attempt failed).

Begin the hook body by setting up three state variables using `useState`: `isOnline` initialised to `navigator.onLine` (always check the current value at hook initialisation rather than assuming online), `isSyncing` as false, and `syncError` as null.

The first `useEffect` listens to the browser's `online` and `offline` window events. Register event listeners for both events on mount. The `online` handler sets `isOnline` to true. The `offline` handler sets `isOnline` to false. Clean up both listeners in the effect's return function. This effect has an empty dependency array.

The second `useEffect` reacts when the `isOnline` state transitions from false to true — it triggers the sync attempt. Its dependency array contains `[isOnline]`. Inside: if `isOnline` is false, return early and do nothing. Call `getQueuedSale()` from `src/lib/idb-store.ts`. If the result is null, return — there is nothing to sync. If a queued sale is found, proceed with the sync flow.

The sync flow: set `isSyncing` to true and `syncError` to null. Extract the `payload` and `queuedAt` fields from the queued sale record. Inject the `queuedAt` value into the payload object under the key `queued_at` (so the API route's staleness check can inspect it — as described in Task 03.02.06 Step 2). Call `POST /api/sales` with the enriched payload using the project's API request utility.

If the API call succeeds (HTTP 2xx response): call `dequeueOfflineSale` with the numeric key to remove it from IndexedDB. Set `isSyncing` to false. Trigger the `onSaleComplete` callback — but since this hook does not receive the callback directly, dispatch a custom `CustomEvent` on `window` with the event type `"velvetpos:offlineSaleSynced"` and the sale response as the event `detail`. The terminal page component listens for this event and opens the Receipt Preview Dialog. This decoupled event pattern avoids passing a callback deep into the hook.

If the API call returns HTTP 410 (the expired/stale case documented in Task 03.02.06): call `dequeueOfflineSale` to remove the stale payload, set `isSyncing` to false, and set `syncError` to "Offline sale was too old to process and has been discarded. Please re-enter the sale." Show a warning toast using the project's toast utility in addition to setting the error state.

If the API call returns any other error (network error or non-2xx/410 status): set `isSyncing` to false. Do NOT dequeue the sale. Set `syncError` to a human-readable message based on the error. The failed sale remains in IndexedDB and will be retried the next time `isOnline` transitions to true. Limit retry attempts by checking a `retryCount` field in the queued payload — if it exceeds 3, auto-discard and set `syncError` to "Offline sale failed to sync after 3 attempts and has been discarded."

### Step 5: The Queue Limit and One-Sale Rule

The `useOfflineSync` hook must enforce a limit of exactly one pending sale in the queue at a time. When the `offline` event fires and the cashier attempts to submit a sale (this is handled in the terminal page component, not inside the hook), the terminal component should check `hasPendingSale` before allowing a second submission. If `hasPendingSale` is true, the terminal shows a blocking warning: "You have an unsynced sale from when the terminal was offline. Please wait for it to sync before starting another sale." The cashier cannot proceed until either the sync completes or they manually discard the pending sale via a "Discard" option in the warning panel.

The one-sale limit is a deliberate constraint. Allowing multiple queued offline sales creates exponential complexity in sync ordering, partial failure handling, and stock deduction sequencing. For a retail POS in a Sri Lankan clothing store, a single network dropout lasting more than a few seconds is unusual, and the business expectation is that cashiers pause activity during extended outages rather than accumulate a backlog.

### Step 6: Offline Status Badge

In `src/app/[tenantSlug]/terminal/page.tsx`, import `useOfflineSync` and render the offline status badge in the terminal header area. The badge is a small pill element implemented with Tailwind utility classes. When `isOnline` is false, render a pill with a solid amber background (`bg-yellow-500` or the project's warning colour token), white text, and the label "Offline". When `isSyncing` is true and `isOnline` is true, render a pill with a blue info background and the label "Syncing…" with a small animated spinner. When `isOnline` is true and `isSyncing` is false, render nothing — the absence of the badge is the "normal" state and no "Online" pill is needed. Showing a green "Online" badge at all times would add visual noise without information value.

Apply a smooth transition between badge states using Tailwind's `transition-opacity duration-300` and conditional opacity rendering rather than conditional rendering, to avoid layout shifts in the header when the badge appears or disappears.

### Step 7: Wire the Hooks into the Terminal Page

In `src/app/[tenantSlug]/terminal/page.tsx`, add the following integration points:

Import `usePersistCartEffect` and `useOfflineSync`. Obtain the current `cartState` from the Zustand store using the project's cart state selector. Call `usePersistCartEffect(cartState, params.tenantSlug)` unconditionally at the top of the component — the hook manages its own effect lifecycle. Call `useOfflineSync(params.tenantSlug)` and destructure the four returned fields.

Add a `useEffect` that registers a listener for the `"velvetpos:offlineSaleSynced"` `CustomEvent` on `window`. When the event fires, extract the sale from `event.detail` and open the `ReceiptPreviewDialog` with the synced sale data — the same path that a normal online sale submission takes.

In the Zustand cart store's `clearCart` action (called by the "New Sale" flow), add a call to `clearCartSnapshot` from `idb-store.ts` so that completing a sale and starting a new one also clears the IndexedDB cart snapshot. This prevents an old completed cart from being incorrectly restored if the terminal is refreshed shortly after a sale completes.

---

## Expected Output

- `src/lib/idb-store.ts` created with the database open function and all six helper functions exported.
- `src/app/[tenantSlug]/terminal/hooks/usePersistCartEffect.ts` created and wired into the terminal page.
- `src/app/[tenantSlug]/terminal/hooks/useOfflineSync.ts` created and wired into the terminal page.
- The amber "Offline" badge appears in the terminal header within one second of the network going down.
- Cart contents survive a full browser page refresh.
- A sale attempted while offline is queued and auto-submitted on reconnect.

---

## Validation

- Add items to the cart on the terminal, then refresh the browser — confirm the cart is restored with the same items and quantities.
- Complete a sale via the normal online flow, then immediately refresh — confirm the cart is empty after restore (the completed sale's cart was cleared).
- Open browser DevTools → Network tab → set throttle to "Offline" and attempt to submit a sale — confirm the terminal shows the "Offline" badge and the sale is not submitted immediately.
- Set the network back to "Online" in DevTools — confirm the sale is submitted automatically, the "Syncing…" badge appears briefly, and the Receipt Preview Dialog opens on success.
- Check IndexedDB in DevTools → Application → IndexedDB → `velvetpos_offline_db` → `sale_queue` and confirm the record is deleted after successful sync.
- Test the stale sale scenario by manually editing the `queuedAt` timestamp in IndexedDB to a value more than 4 hours in the past, then going online — confirm the sale is discarded and a warning message appears.

---

## Notes

- `idb` version 8.x is the current stable version as of 2026. The API uses `openDB`, `IDBPDatabase`, and store method calls (`db.get`, `db.put`, `db.delete`, `db.getAllKeys`). Use named imports for all idb functions.
- IndexedDB is only available in the browser environment. All idb-store functions must check for `typeof window !== "undefined"` before calling `openDB` to prevent runtime errors during Next.js server-side rendering or static generation passes. Add this guard at the top of each function in `idb-store.ts`.
- The `CustomEvent` dispatch pattern avoids tightly coupling `useOfflineSync` to the terminal's React component tree. Any component in the page can listen for the `"velvetpos:offlineSaleSynced"` event without being passed a callback prop. This keeps the hook usable across future multi-terminal layout variations.
- The `navigator.onLine` property is not perfectly reliable in all browsers — it returns false for definite offline states but may return true even when the network is degraded rather than fully down. This is a known browser limitation. For Phase 3, the `navigator.onLine` approach is sufficient for the Sri Lankan retail context where network failures tend to be complete rather than gradual.
- Do not implement background sync using the Service Worker Background Sync API in Phase 3. Service Worker setup adds significant complexity (registration, update lifecycle, push notification scoping). The `window.online` event approach is simpler, covers the required use case, and can be upgraded to a Service Worker implementation in a future phase without changing the hook's public interface.
