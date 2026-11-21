# Bank salary worksheet (ARGUS #384)

## Problem

The export was labelled **Bank salary sheet** and described as "ready for
corporate banking batch upload", but it only contained:

`No. | Employee Name | Bank | Branch | Account Number | Net Salary`

That is not a bank upload file. A real batch layout needs bank/branch codes,
account type, the company debit account, payment date, narration, transaction
code, and often header/trailer records, with per-bank grouping. `bankName` and
`bankBranch` here are also free text from the staff profile, not bank reference
codes. Presenting the file as a bank batch could lead to a rejected or wrongly
credited payment run.

No concrete bank template exists in the repository, so inventing one would be
worse than being explicit about what the file is.

## What the export is now

The download is honestly named a **Bank salary worksheet**:

- UI card: "Bank salary worksheet", with copy saying it is not a bank batch file.
- XLSX sheet name and PDF heading: `Bank Salary Worksheet`.
- Filename: `bank-salary-worksheet-YYYY-MM.xlsx|pdf`.
- Header disclaimer in both formats.
- Payment preflight label: "Bank salary worksheet".

The snapshot already stores NIC, so the worksheet adds **NIC** as an identity
reference alongside name, bank, branch, account number and net salary. No new
data is invented or written back to the database.

## Required before a real bank upload

A bank-specific file must be produced by (or verified against) the target bank's
template. At minimum it needs:

| Field | Source / action |
| --- | --- |
| Bank code / branch code | bank's reference list - not stored in the run |
| Account type | bank template / employee record - not stored |
| Company debit account | tenant payment account - not stored on the run |
| Payment date | payment action date - not stored on the run |
| Narration | bank template |
| Transaction / payment code | bank template |
| Header and trailer/control totals | bank template |
| Per-bank grouping and ordering | bank template |

Until such a template is added, the worksheet is a reviewed source document for
manual entry, not an upload file.

## Verified behaviour

`documents.test.ts` asserts the worksheet renders in XLSX/PDF, the sheet name is
`Bank Salary Worksheet`, the disclaimer is present, the header includes NIC and
the filename is `bank-salary-worksheet-<month>`. No schema or migration change
is involved.
