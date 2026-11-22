# POS cart ownership and logout (ARGUS #66)

The active cart is terminal state, but it must never follow a different cashier
or a different shift. Persistence is now **scoped**, and explicit logout/shift
close clears it.

## Storage key

`src/lib/pos/cartPersistence.ts` builds:

```
ayurpos_cart_<userId>_<shiftId>
```

- Same cashier + same shift → the cart is restored after reload (unchanged
  convenience).
- Different user or different shift → a different key, so the previous cart is
  not loaded.
- If either id is not resolved yet (session/shift hydration), the key is `null`
  and the cart is not persisted or restored — never a shared fallback bucket.
- The old terminal-wide `ayurpos_cart_default` key is deleted on first use and
  never read, so a cart left by the buggy version cannot reappear.

## Clearing

- **Explicit sign-out** (`SignOutButton`, store header, ShiftOpenModal’s “Back
  to Login”, suspended screen): `clearCartOnSignOut()` clears the in-memory
  zustand cart and deletes every cart snapshot from IndexedDB. A failure to open
  IndexedDB never blocks sign-out.
- **Session expiry**: `usePersistCartEffect` watches `useSession()` and runs the
  same clear when the status becomes `unauthenticated`.
- **Shift close**: after a successful close, `ShiftCloseModal` clears the live
  cart and every snapshot whose key ends with that shift id. The next shift
  starts clean.
- Explicit POS flows (completed sale, undo clear) continue to clear the
  **current scoped** snapshot.

Held sales and the offline sale queue are separate stores/keys and are not
touched.

## Tests

`src/lib/pos/__tests__/cartPersistence.test.ts` covers key scoping, missing
ownership, shift matching and legacy-key detection.
