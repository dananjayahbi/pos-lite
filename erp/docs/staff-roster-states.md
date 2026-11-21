# Staff roster states

ARGUS #462. A roster request that returned 504/500 (or failed for any reason)
rendered the table headers with zero rows, exactly like an empty team.

## Contract

`src/lib/services/staffRosterState.core.ts` returns one of:

- `loading` — first request in flight;
- `error` — request failed (wins over `empty` and stale rows);
- `empty` — successful response with zero rows;
- `ready` — successful response with rows.

Both `/staff` and the Team & Permissions roster use the helper and render:

- loading skeletons;
- an explicit error message with **Retry** (the query's `refetch`);
- a distinct empty message;
- the table only in `ready`.

The error state includes the API message when one is available, never a raw
stack or Prisma dump.

## Verification

- `src/lib/services/__tests__/staffRosterState.core.test.ts`
- `npx tsc --noEmit`
