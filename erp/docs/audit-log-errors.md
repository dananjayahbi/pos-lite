# Audit log load and export errors

A failed audit request rendered "No audit log entries found." with zero cards,
and a failed CSV export threw with no user message (ARGUS #455).

`auditListMode({ isLoading, isError, count })` makes error win over loading and
empty. The table now renders a red **Audit log could not be loaded** card with a
Retry button for any query failure, and only shows the genuine empty state after
a successful empty response. The export button tracks its own pending state and
shows an error toast on failure.

## Verification

`auditList.core.test.ts` covers error precedence, loading, empty and ready.
