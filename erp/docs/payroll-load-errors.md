# Payroll load errors (ARGUS #377)

## Problem

Both payroll screens read `json.data ?? []` and ignored `res.ok`. A failed run
list therefore rendered a business empty state:

- `/payroll` - "No payroll has been generated yet."
- `/payroll/reports` - "No payroll run exists for {month}. Generate it first."

A 404 detail request could also surface a raw parser message such as
`Unexpected token '<', "<!DOCTYPE"...` when the server returned an HTML error
page.

## Rules

`src/lib/payroll/api-load-state.ts` is pure and unit tested:

```ts
resolvePayrollLoadState({ isLoading, isError, hasData })
  -> 'loading' | 'error' | 'empty' | 'ready'
```

- `error` always wins, including when stale data is present. A failed request
  can never render an empty state or the "generate it first" prompt.
- `loading` wins only until data is available.
- `empty` is reserved for a successful response with no rows.

```ts
parsePayrollApiEnvelope(status, bodyText)
  -> { success: true, data } | { success: false, failure }
```

- A well-formed `{ success:false, error:{ code, message } }` keeps its message
  and code.
- HTML, empty, truncated or otherwise non-JSON bodies fall back to safe status
  copy: 401 session expired, 403 permission, 404 not found, 5xx service
  unavailable, otherwise `The payroll request failed (HTTP n).`
- Parser messages are never returned.
- A `200` body with `success:false` is still treated as a failure.

`fetchPayrollEnvelope<T>(url)` applies both helpers, throws a safe `Error` for
React Query, and is used for the preview, run list, run detail and payment
account queries.

## UI

`/payroll` and `/payroll/reports` now render explicit load-error cards with a
**Retry** button. Retrying the reports detail refetches both the list and the
detail so a run deleted between the two requests recovers. The empty states and
the generate prompt only render after a successful list response.

No API contract, schema or migration change is involved.
