# ARGUS batch 13 (100 tasks) - final state

All 100 newly added pending tasks were implemented. 96 had Definition-of-Done
items and were submitted to Atlas; the 4 proposal tasks (which have no DoD, so
Atlas rejects their submission) were implemented and merged with docs.

Final checkpoint: **2,567 tests / 331 files green**, `tsc` clean.

## Implemented and submitted (96)

- Customers: #312, #313, #314, #316
- Promotions: #327-#333
- Staff Directory: #340-#345
- Attendance & Timeclock: #352-#358
- Staff Commissions: #362-#368
- Run Payroll: #375, #376, #377, #378, #379
- Payroll Reports: #384, #385, #386, #387, #388, #389, #391
- Expenses: #396-#403
- Petty Cash: #407-#413
- Cash Flow: #418-#421
- Payment Accounts: #426-#430
- Sales & Profit Reports: #436-#438
- Saved Reports: #445, #446, #447
- Audit Log: #454, #455, #456
- Team & Permissions: #459-#463
- Taxes & Store Settings: #469-#472
- Units: #479-#481
- Store Profile: #488, #489
- Website CMS: #497, #498
- My Account: #504
- Failed Deliveries & Recovery: #515
- Waybill: #299
- Other: #46 (Low Stock card note)

## Implemented, merged, but cannot be submitted (no DoD items)

- Baseline Prisma migrations (P3005) - schema diff empty, 54/54 baselined,
  `migrate status` is up to date.
- Void credit restoration (older claim).
- Reports > Stock Movements shared 13-reason catalog (proposal).
- Seed PO subtotal/receipt consistency (proposal).
- Soft-deleted BOM revival (proposal).
- Dispatch orphaned-waybill audit on rollback (proposal).

## Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 2,567 passed in 331 files.
- All work merged into `argus_qa`; nothing pushed.
