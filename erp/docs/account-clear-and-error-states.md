# My Account: clear, validation and load-error states

ARGUS #507. After a validation message such as "New password must be different
from the current password", clicking **Clear** emptied the three fields but
left the error and any success banner visible, and Clear stayed active while a
save was in flight. A failed profile GET showed only the returned error text
with no way to retry (dead end).

## Contract

- `AccountPasswordForm.resetForm()` clears the values, resets every field
  error, clears the success banner and cancels the signed-out banner state.
- **Clear** is disabled while saving; **Update Password** is disabled while
  saving and after success.
- Validation errors are rendered per field; API `details[]` paths are mapped
  onto the same fields, so a server rejection is not toast-only.
- `AccountSettingsClient` loads through a callable `loadProfile()`; the error
  block has `role="alert"` and a **Retry** button that re-runs the GET and
  clears the previous error.
- The success banner uses `role="status"`/`aria-live="polite"`.

## Verification

UI-only changes. Nearest tests:
`src/lib/auth/__tests__/password-policy.core.test.ts` (message/rule parity)
and `src/lib/services/__tests__/accountProfile.core.test.ts`; `tsc` covers the
client props and route response shape.
