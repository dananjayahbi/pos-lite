# ARGUS batch 13 queue (100 claimed)

All 100 newly added pending tasks are claimed by
`opencode-deepseek-v4.1-flash` and `IN_PROGRESS`. They are split into six
workstreams plus two main-agent items. Atlas remains the source of truth.

## Batch 1 (running now)

| Agent / worktree | Module | ARGUS tasks |
| --- | --- | --- |
| catalog (`agent-catalog`) | Customers | #312 spend bands, #313 load errors, #314 edit permission, #316 export audit/CSV safety |
| pos (`agent-pos`) | Promotions | #327 local date windows, #328 400/404 mapping, #329 live states, #330 required targets/codes |
| sales (`agent-sales`) | Cash Flow | #418 ledger bridge, #419 unallocated payments, #420 cash movement bridge, #421 access/error states |
| factory (`agent-factory`) | Expenses | #396 register export, #397 approval control, #398 page gate, #399 account/fund column |
| reports (`agent-reports`) | Staff Directory | #340 audit, #341 PII list DTO/masking, #342 0-100 commission, #343 attendance/period coverage |
| payroll (`agent-payroll`) | Run Payroll | #375 zero-run guard, #376 missing-attendance, #377 load errors, #378 export preflight |
| main | misc | #46 Low Stock card note (submitted), BOM soft-delete restore (done, no DoD) |

## Queued after batch 1

Counts per module (all claimed, all `IN_PROGRESS`):

- Customers: #312-316 (3 remaining after batch 1: #312-314, #316 in batch; only
  #315 done earlier; this batch covers all 4 new customer tasks).
- Promotions: #327-333 (3 remaining: #331 audit/usage, #332 page permission,
  #333 customer-pricing identity).
- Staff Directory: #340-345 (2 remaining: #344 page permission, #345 VAT
  commission basis).
- Attendance & Timeclock: #352-358 (7).
- Staff Commissions: #362-368 (7).
- Run Payroll: #375-379 (1 remaining: #379 advance ledger).
- Payroll Reports: #384-391 (7).
- Expenses: #396-403 (4 remaining: #400 controls, #401 history, #402 error
  state, #403 transaction).
- Petty Cash: #407-413 (7).
- Cash Flow: #418-421 (done in batch 1).
- Payment Accounts: #426-430 (5).
- Sales & Profit Reports: #436-438 (3).
- Saved Reports: #445-447 (3).
- Audit Log: #454-456 (3).
- Team & Permissions: #459-463 (5).
- Taxes & Store Settings: #469-472 (4).
- Units: #479-481 (3).
- Store Profile: #488-489 (2).
- Website CMS: #497-498 (2).
- My Account: #504 (1).
- Failed Deliveries & Recovery: #515 (1).
- Waybill: #299 (1).
- Proposed/triage items included in the claim: seed PO drift, Reports stock
  movement reasons, dispatch courier/transaction ordering (3).

## Notes

- Every task must be submitted with `log_task_progress` before
  `submit_for_review`; proposed tasks with zero DoD items cannot be submitted.
- No new pending tasks will be claimed until batch 1 is merged and the queue is
  visibly down to the last modules.
- Batches are merged into `argus_qa` and followed by `tsc` + full Vitest
  checkpoints.
