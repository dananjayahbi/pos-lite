# Waybill template provenance and reset protection

The designer used to keep Save enabled with no edits, reset the saved sender in
one click with no confirmation, lose unsaved edits on navigation, and never say
who last changed the template (ARGUS #305).

## Behaviour

- The sender fields are read-only and sourced from the Store Profile
  (ARGUS #301), so there is no editable sender state to lose on navigation.
- `Tenant.settings.delivery.labelMeta` records the last write: timestamp, user,
  email and role, plus whether it was a save or a reset.
- The designer shows `labelTemplateProvenance()`: "Saved 22 Nov 2026, 10:30 by
  Owner (owner)" or "Using the Store Profile defaults".
- **Reset to default** only appears when a saved override exists, is
  permission-gated by `manageLabelTemplate`, and opens a confirmation panel
  before clearing. Reset keeps the Store Profile sender, so the label still
  prints the business name.

## Verification

`labelTemplateState.test.ts` covers the default, saved and reset provenance
text. `tsc --noEmit` covers the new meta plumbing.
