# Petty-cash CSV lists individual cash-in rows (ARGUS #412)

The audit-trail export had only a Balance Statement, Expenses and Category
Totals. A Rs 1.00 top-up appeared only inside the aggregate
`Cash In (Top-ups)` line, so the individual transaction could not be audited
from the downloaded file.

## Resolution

`buildPettyCashExportData` now returns a `topUps` array for the same period as
the balance statement:

- date (`entryDate`);
- source (`External cash` for a `DEPOSIT`, otherwise the paired source
  account's name, falling back to `Account transfer`);
- note (`PaymentAccountEntry.description`);
- operator email (`createdById` resolved tenant-scoped);
- amount (`debit`).

The export adds a **CASH IN (TOP-UPS)** section between the Balance Statement
and Expenses, with columns Date, Source, Note, Recorded By and Amount.
Text cells reuse `neutralizeCsvFormula`, so a note or source beginning with a
formula character is neutralised.

The category filter does not affect cash-in rows or the balance statement; the
`Basis:` line now says so explicitly.

The aggregate `Cash In (Top-ups)` statement line remains, and it reconciles to
the sum of the listed period rows for that window.

## Verification

`src/lib/petty-cash/__tests__/export-cash-in.test.ts` covers the header and
rows, external versus account sources, empty periods, and formula
neutralisation. `npx tsc --noEmit` covers the service and route wiring.
