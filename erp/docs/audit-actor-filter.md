# Audit actor discoverability and scope

The Actor ID filter required a raw CUID that the table/modal never displayed, and
actor names were resolved with a global user lookup that could show another
tenant's name for a foreign id (ARGUS #456).

- The detail modal now shows the full, selectable **Actor ID**; table rows expose
  it in the User cell tooltip, and the filter hint explains where to copy it.
- `attachAuditActorNames(entries, tenantId)` scopes the user lookup to the
  current tenant when one is supplied. The audit route passes the tenant for
  normal users and omits it only for the SUPER_ADMIN cross-tenant ledger; the
  raw-material history passes its tenant too.

## Verification

`tsc` covers the signature and all call sites; the existing audit suites remain
green. The query scope is not unit-testable without a database in this suite.
