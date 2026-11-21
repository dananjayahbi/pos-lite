# Store Profile save refreshes the ERP shell

The Store Profile form updated its own state and showed "Store profile saved",
but the sidebar, POS header and dashboard kept the old business name/logo until
a full reload. Those surfaces receive `businessName`/`businessLogoUrl` from the
server `(store)/layout.tsx`, and the form only mutated local client state
(ARGUS #488).

## Behaviour

After a successful `PATCH /api/settings/store`, the form now:

1. updates its local baseline as before;
2. invalidates the caches that embed tenant branding
   (`['label-template']`, used by waybill/dispatch surfaces);
3. calls `router.refresh()`, which re-runs the server layout and passes the new
   `Tenant.name`/`logoUrl` into `StoreLayoutClient` (sidebar, desktop header and
   POS shell).

The refresh plan lives in
`src/lib/settings/storeProfileRefresh.core.ts` so the exact keys and the shell
refresh cannot drift from the form, and it deliberately avoids a wildcard
invalidation.

## Verification

`src/lib/settings/__tests__/storeProfileRefresh.core.test.ts` asserts the shell
refresh flag, the `label-template` invalidation and that the plan uses concrete
query-key prefixes rather than a refetch-everything wildcard. No schema or API
contract changed.
