# Commission report load states (ARGUS #363)

## Problem

The commission report read `data?.data ?? []` and only checked `res.ok` with a
generic throw. A 404/500 looked like a real business state:

- Open liability: Rs 0.00
- "No commission data for this period."
- "No payouts recorded..."

There was no visible error and no Retry.

## States

`src/lib/services/commission-report-state.ts` is pure and unit tested:

```ts
resolveCommissionReportState({ isLoading, isError, hasData })
  -> 'loading' | 'error' | 'empty' | 'ready'
```

- `error` always wins, even when stale data exists.
- `loading` wins only before data is available.
- `empty` is reserved for a successful response with no rows.

`parseCommissionApiEnvelope(status, bodyText)` keeps a well-formed
`{ success:false, error:{ message } }` message/code and falls back to safe copy
for HTML/empty/truncated bodies:

| Status | Copy |
| --- | --- |
| 401 | Your session has expired. Sign in again to load commissions. |
| 403 | You do not have permission to view commission reports. |
| 404 | The commission report was not found. |
| 5xx | The commission service is unavailable. Try again in a moment. |

Parser messages are never returned. `fetchCommissionEnvelope<T>` applies both
helpers for the summary, payout history and payment-account queries.

## UI

- A failed summary shows **Could not load commission summary: ...** with
  **Retry**; Open liability reads **Unavailable**, never Rs 0.00.
- A failed payout history shows **Could not load payout history: ...** with
  **Retry**.
- Export CSV is disabled unless the summary is `ready`.
- Empty states and the payout form only render after a successful response.

No API contract, schema or migration change is involved.
