# Account password policy (72-byte cap, same-password rule)

ARGUS #505. The only password rule was "at least 8 characters". bcrypt hashes
at most **72 bytes** and silently ignores the rest, so an 80-character password
verified true against its first 72 bytes plus any suffix - entropy the user
believed they had was discarded. The API also accepted a new password identical
to the current one (only the form blocked it) and an empty payload returned
zod's raw `Invalid input: expected string, received undefined`.

## Contract

`src/lib/auth/password-policy.core.ts` owns the rules and messages:

- minimum 8 characters;
- maximum 72 **UTF-8 bytes** (`passwordByteLength`, matching bcrypt);
- new password must differ from the current one;
- optional confirmation must match.

The form and `POST /api/settings/account` both call it, so the visible rules
and the enforced rules cannot drift.

The route additionally compares the new password against the stored hash with
`bcrypt.compare`, rejecting an identical secret with a typed
`400 VALIDATION_ERROR` and `details: [{ path: 'newPassword' }]`. Validation
errors now carry field paths and friendly messages, which the form maps onto
the matching input instead of a single toast.

## Verification

- `src/lib/auth/__tests__/password-policy.core.test.ts`
- `npx tsc --noEmit`
