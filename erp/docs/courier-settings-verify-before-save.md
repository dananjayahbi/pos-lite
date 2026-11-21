# Courier settings: verify before saving, explicit clears

"Test connection" and "Sync locations now" used to PUT the whole form first,
including `isActive` and partial credentials, then call the probe. A failed test
left an invalid, active account saved. Empty email, pickup and origin values
were also omitted from the payload, so clearing them silently kept the old value
(ARGUS #513).

## Behaviour

- `POST /api/store/delivery/settings` is a dry run. It accepts the current form
  values as an optional JSON body and never writes the account. Omitted secrets
  fall back to the saved row; the response reports `persisted: false`.
- `POST /api/store/delivery/locations` accepts the same optional body and syncs
  with the unsaved credentials. Only the location cache is written.
- `PUT` always sends `email`, `pickupAddress` and both origin ids. Empty values
  become `null` (explicit clear). An empty password/API key keeps the saved
  secret.
- Activation is validated server-side against the merged effective account:
  an active account needs an API key or email + password, plus origin district,
  city and pickup address. Inactive drafts may stay partial.
- The UI no longer calls `save` from Test/Sync; it tells the operator to save to
  keep the verified values.

## Verification

`src/lib/courier/__tests__/settings.core.test.ts` covers clear semantics,
secret preservation/replacement, the activation matrix and dry-run credential
fallback.
