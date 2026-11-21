# Petty cash reads are read-only; setup is explicit (ARGUS #408)

Opening `/petty-cash` used to call `getOrCreateFund` from `GET
/api/store/petty-cash`. A user holding only `petty_cash:view` could therefore
create the fund, its payment account and opening-balance ledger entries simply
by loading the page. The schema has no tenant-wide unique constraint on
`PettyCashFund`, so two concurrent first loads could also create two funds; the
page and export then silently read the first.

## Read path

`GET /api/store/petty-cash` is now read-only (`getPettyCashReadState`):

| Tenant state            | Response                                                |
| ----------------------- | ------------------------------------------------------- |
| no active fund          | `200`, `data:null`, `setupRequired:true`                |
| exactly one active fund | `200`, fund + balance + top-ups                         |
| two or more active funds| `200`, `data:null`, `multipleFunds:true`, `fundCount`, `message` |

The page renders a **Set up Petty Cash** card for the first case and a duplicate
warning for the third. It never picks the first fund behind the user's back.

The audit-trail export is stricter: `buildPettyCashExportData` returns
`409 MULTIPLE_FUNDS` rather than exporting a guessed fund.

## Setup path

`POST /api/store/petty-cash/setup` requires `petty_cash:manage` and is
idempotent:

1. An in-process per-tenant promise chain serializes local callers.
2. A PostgreSQL transaction-scoped advisory lock
   (`pg_advisory_xact_lock(hashtext('petty-cash-fund:<tenantId>'))`) serializes
   cross-instance callers. After acquiring it the transaction re-reads; if a
   winner already created the fund it stops instead of inserting.
3. `ensureFundPaymentAccount` takes a second advisory lock keyed by tenant and
   fund, re-checks the link inside the transaction, and only then creates or
   reuses the account/opening entry. This closes the same race for the account.
4. If duplicates already exist, setup returns `409 MULTIPLE_FUNDS` and does not
   choose one.

`topUpPettyCash` and other legacy callers now go through `getOrCreateFund`,
which delegates to the same locked setup path.

There is still no database uniqueness constraint because that needs a
migration. The advisory lock closes the concurrent-create window, but a
manual/insert process outside this service could still create duplicates; the
read/export flag is the detection net.

## Verification

- `src/lib/petty-cash/__tests__/setup-state.test.ts` covers not-configured,
  ready and multiple states and confirms duplicates never expose a fund id.
- `npx tsc --noEmit` covers the service, route and page wiring.
