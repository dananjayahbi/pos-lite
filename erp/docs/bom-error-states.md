# BOM error states and retry

Failed BOM requests used to look like genuine empty or loading states
(ARGUS #252):

- a failed list rendered "No bills of materials yet",
- a failed detail request left the Edit dialog blank, and
- a failed production plan left the Produce dialog on "Loading BOM…" /
  "Calculating consumption…" with Log production permanently disabled and no
  way to retry.

## Behaviour

### List

`BomListClient` resolves its state with `resolveFactoryFeedState()` (error
first, then loading, empty, data). On failure it shows a red card with the
server message, the explicit note that this is not an empty result, and a
**Retry** button that refetches the list. Cached rows are not shown as current.
The genuine empty state ("No bills of materials yet...") is only rendered after
a successful response with zero rows.

### Edit dialog

`BomFormDialog` keeps the form hidden until the detail request succeeds:

- error: red card with the request message and **Retry**; no blank form and no
  Save button, so a failed load can never overwrite the recipe,
- loading: an explicit "Loading BOM details..." line,
- success: the normal populated form.

The Create dialog is unaffected because it does not depend on a detail request.

### Produce dialog

`ProductionLogDialog` now surfaces both queries:

- BOM detail failure appears under the header with its own **Retry**; the
  header falls back to the production plan's variant name when available.
- Plan failure replaces "Calculating consumption…" with a red card naming the
  error and a **Retry** button. Log production stays disabled until a
  successful plan exists (unchanged safety rule), but it is no longer stuck
  without a recovery path.
- Successful plan and submit paths are unchanged.

The query hooks in `src/hooks/useBom.ts` now read the API envelope's
`error.message`, so the cards explain the actual failure instead of always
showing a generic fallback.

## Verification

- `npx tsc --noEmit`
- Manual states can be reproduced by forcing the corresponding route to fail
  (for example, an offline request or a 500 from the BOM list/detail/plan
  endpoints). Component tests are not part of the Node-only vitest setup.
