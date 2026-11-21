# Store Profile Save waits for the logo upload

The Store Profile logo upload is asynchronous, but Save stayed enabled while the
file was in flight. Clicking it persisted the previous `logoUrl`; when the
upload completed, the form value changed again and was left dirty with the new
logo unsaved (ARGUS #489).

## Behaviour

- `LogoUploadField` now reports upload start/settle through
  `onUploadingChange`. It settles on success, HTTP failure, network failure and
  a synchronous send error, so the parent cannot be stuck disabled.
- `resolveStoreProfileSaveState` (`src/lib/settings/storeProfileSave.core.ts`) is
  the single Save gate, in priority order: already saving, logo uploading,
  store name shorter than 2 characters, no unsaved changes.
- The form disables Save and the upload/remove controls while an upload is
  running, and `handleSave` returns early as a second guard.
- The button reads "Uploading logo..." and helper text says Save is disabled
  until the upload finishes. Once it finishes, the new URL makes the form dirty
  and Save becomes available with the correct value.
- The upload controls are also disabled while a save request is in flight.

## Verification

`src/lib/settings/__tests__/storeProfileSave.core.test.ts` covers the ready
state, in-flight upload (even when dirty), save-in-flight priority, short name,
clean form and the control lock. No schema or API change.
