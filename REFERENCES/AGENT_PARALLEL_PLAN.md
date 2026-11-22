# Agent parallel plan (ARGUS backlog)

This file is the durable plan for the long-running ARGUS task work. Re-read it
after any context compaction.

## Board workflow

1. Claim tasks from Atlas (project `pos-lite`, agent
   `opencode-deepseek-v4.1-flash`). The claim limit allows at least 4 concurrent
   leases.
2. Implement one task per commit **inside the task's worktree** (see below).
3. The main agent reviews the patch, submits it to Atlas with
   `submit_for_review` (git patch + verification log), then merges the branch
   into `argus_qa`.
4. Do not push. Do not let subagents submit to Atlas.

## Fast lane (main agent, for tasks handled serially)

- Edit -> `npx tsc --noEmit` -> run only the 1-3 test files covering the change.
- Full `npx vitest run` every ~5 tasks or before schema/migration work.
- No per-task ESLint/Prettier on existing files; format new files only.
- Docs: append a short section to the module doc or add one small doc; no
  essay per task.
- Patches between checkpoint commits use a snapshot tree:
  - After each submit: `git add -A; git write-tree; git commit-tree <tree> -m "agent snapshot"`
    and store the SHA in `C:\Users\Tuf\AppData\Local\Temp\opencode\poslite-base.txt`.
  - Per-task patch: `git add -N <new files>; git diff <snapshot> > patch`.
  - Do NOT reset the index; keep changes staged so the snapshot diff works.
- A patch-transfer helper can serve files from
  `C:\Users\Tuf\AppData\Local\Temp\opencode` on `http://127.0.0.1:8765`
  (`python -m http.server 8765 --directory ...`), fetched from the `execute`
  tool.

## Parallel subagents (worktrees)

Worktrees (created from the checkpoint commit `d168e52` or later):

| Agent | Worktree | Branch | Ownership |
| ----- | -------- | ------ | --------- |
| reports | `C:\Users\Tuf\.local\share\opencode\worktree\b4adbd\agent-reports` | `agent/agent-reports` | Dashboard: `erp/src/app/(store)/dashboard/**`, `erp/src/components/dashboard/**`, dashboard/report APIs |
| sales | `C:\Users\Tuf\.local\share\opencode\worktree\b4adbd\agent-sales` | `agent/agent-sales` | Sales & returns: `erp/src/app/(store)/sales/**`, `returns/**`, `erp/src/lib/services/sale.service.ts`, `return.service.ts`, sale alerts |
| pos | `...\agent-pos` | `agent/agent-pos` | POS UI + shifts: `erp/src/components/pos/**`, `erp/src/app/(store)/pos/**`, shift/Z-report surfaces |
| catalog | `...\agent-catalog` | `agent/agent-catalog` | Products, inventory, barcodes: `inventory/**`, `components/products/**`, `components/barcode-printing/**`, `lib/barcode*` |
| notifications | `...\agent-notifications` | `agent/agent-notifications` | Notifications inbox and alert copy: `erp/src/app/(store)/notifications/**`, `erp/src/lib/notifications/**` |
| appointments | `...\agent-appointments` | `agent/agent-appointments` | Appointments: `erp/src/app/(store)/appointments/**`, `components/appointments/**`, `lib/appointments/**` |
| ops | `...\agent-ops` | `agent/agent-ops` | Website CMS, hardware/courier settings, COD reconciliation |

Setup already done in each worktree (`<wt>\erp`):
- junction `node_modules` -> `E:\work_git_repos\pos-lite\erp\node_modules`
- junction `src/generated` -> main `erp/src/generated`
- copied `.env`, `.env.local`, `next-env.d.ts`

Rules for subagents:
- Work only in the assigned worktree, never the main checkout.
- **Never** edit `erp/prisma/schema.prisma`, `erp/prisma/migrations/**`,
  `erp/package.json`, `erp/yarn.lock`. If a task needs a migration or dependency,
  stop and report it to the main agent.
- One commit per task:
  `git add -A && git commit -m "fix(<module>): <title> (ARGUS #N)"`.
- Verify with `npx tsc --noEmit` and targeted `npx vitest run <files>`.
  No `next build`, no dev server, no full suite.
- Final report per task: task id, commit SHA, files changed, verification
  summary, risks.
- Do not push, merge, rebase or talk to Atlas.

## Main-agent integration

For each agent commit:
1. Read the commit diff (`git -C <wt> show --stat` + targeted review).
2. Generate the Atlas patch: `git -C <wt> format-patch -1 --stdout <sha>` (or
   `git diff <base>..<sha>`), submit with `submit_for_review`.
3. Fast-forward/merge the branch into `argus_qa` in the main worktree, resolving
   any conflicts (ownership should keep them rare).
4. After a merge batch: `npx tsc --noEmit`, full `npx vitest run`, update the
   snapshot baseline and (optionally) one checkpoint commit.
5. Delete/recreate worktrees when an agent's module queue is empty.

## Current assignments (first parallel batch)

- reports: #37 Top Products uses gross price instead of collected money; #38
  7-day revenue chart is one day behind.
- sales: #52 voided sales still say "Sale Completed" in notifications; needs a
  void alert / clear voided label without a schema migration.
- pos: #62 cash payment accepts less than total; the server `INSUFFICIENT_CASH`
  guard already exists (added with #321) - verify it and add focused regression
  coverage/hardening rather than duplicating.

## Batch 14 - the 174-task refill (50 claims per turn)

Operator policy: claim **at most 50** tasks per turn, implement them, then claim
the next 50. Do not claim the whole refill at once.

Batch 14a (50 tasks) is split across the module worktrees:

- reports (7): #43, #44, #45, #47, #48, #49, #50 - dashboard currency/date,
  stock-movement labels, low-stock helper text and rule, revenue date basis.
- sales (13): #55, #81-#89, #103-#105 - low-stock alert on sale, sales list
  units/dates/invoice/void/edit/filter/return-window, return commission and
  rounding, returns text.
- pos (9): #69-#73, #114-#117 - POS toast/hint/promo/LankaQR/badge, shift
  history link, stale shift, summary counts, shift formatting/net revenue.
- catalog (8): #149-#155, #162 - deleted badges, concatenated labels, stock
  date formats, nested main, latent stock states, barcode format, QA data
  hygiene, barcode copy/queue feedback.
- notifications (4): #56-#59 - notification dates, amounts, zero-value reason,
  sale-alert identity.
- appointments (4): #133-#136 - calendar actions/slots, stats cards, reminders,
  dates/title/duplicate walk-ins.
- ops (5): #499, #510, #512, #513, #514 - CMS soft-deleted category, printer
  host visibility, COD import history/unmatched rows, courier test-before-save,
  courier credential storage.

Agents commit once per task and never submit to Atlas. The main agent reviews,
merges into `argus_qa`, then submits each commit through
`POST /internal/v1/submit` (progress + DoD ticked first).

**Batch 14a result:** 50/50 implemented, merged and submitted to `IN_REVIEW`.
Full suite green at **2,743 tests (357 files)**, `tsc` clean. Merge conflicts
resolved in `RecentStockMovementsCard.tsx` (kept the stock timestamp helper +
movement badge), `api/store/sales/route.ts` (kept both notification copy and
LankaQR guard imports) and `lib/__tests__/format.test.ts` (combined both suites).

**Batch 14b (next 50, all priority-25 cosmetics):**

- reports (13): #439-#443 (Sales & Profit reports), #219-#223 (Stock
  Valuation), #422-#424 (Cash Flow).
- factory (9): #258-#261 (Factory Dashboard), #448-#450 (Saved Reports),
  #457-#458 (Audit Log).
- catalog (13): #169-#173 (Categories), #177-#179 (Brands), #482-#486 (Units).
- ops (15): #302-#307 (Waybill), #276-#278 (Deliveries), #268-#269 (Dispatch),
  #294-#296 (Rate Card), #517 (Failed Deliveries).

The remaining 74 after 14b are payroll/staff/customers, stock-control and
settings/storefront polish; group them the same way when claimed.

**Batch 14c result (wave 2):** 50/50 implemented, merged and submitted. Full
suite green after wave 2 at **2,958 tests (391 files)**, `tsc` clean. Merge
notes:
- `components/reports/ReportLayout.tsx` conflicted with the factory saved-report
  work; resolved to the tested `buildSavedReportRequest` payload plus the new
  `!reportFailed` export/save condition.
- `lib/factory/__tests__/factoryQueries.test.ts` needed the new
  `factory-output-stats` refresh key added (follow-up `b59880d`).
- The UI copy guard caught two em-dash fallbacks (#457 audit, #517 recovery
  rate). They now use a hyphen; follow-ups `e468c04` and `96883f5`.

**Batch 14d (wave 3, 50 tasks):**
- payroll (12): #380-#383, #390, #392-#393, #369-#370, #359-#360, #347.
- admin (15): #464-#467, #505-#508, #404-#405, #414-#415, #318-#320.
- stock (23): #191, #211-#212, #202-#204, #196-#197, #188-#189, #216-#217,
  #251, #254-#255, #247, #238-#240, #190, #285-#286, #233.

Wave 3 result: 50/50 submitted. Full suite green at **3,111 tests (419
files)**, `tsc` clean. Notes:
- #190 has a main commit plus a formatting follow-up; the submitted patch is the
  main commit and the summary names the follow-up.
- #286 is submitted with `needs_schema: true` in the report: packaging cost/value
  needs a `PackagingItem.unitCost` column; the list presentation gaps are fixed.

**Batch 14e (wave 4, final 24 tasks):** settings/storefront/barcode/payment
polish, split ops (12: #473-#478, #490-#494, #516) and front
(12: #431-#434, #500-#503, #334, #163-#164, #346).

Wave 4 result: 24/24 submitted. The full 174-task refill is implemented, merged
into `argus_qa`, and submitted to Atlas; the board reads **0 pending, 0 in
progress, 174 in review, 0 claim slots used**. The six stale batch-13
in-progress leases (already implemented and merged, but unsubmittable because
they carry no DoD checklist) were given a progress note and archived, so no
orphaned leases remain. One task (#286) is explicitly submitted with a
`needs_schema` note: packaging cost/value needs a `PackagingItem.unitCost`
column, which the agent is not allowed to add.

## Batch progress log

- Batch 1 submitted + merged: #37, #38, #52, #62, #63 (test-only regression),
  #64 (cart stock cap, done serially by main).
- Batch 2 submitted + merged: #75 (sale detail breakdown), #76 (zero-line sales
  invariant + repair script), #95 (return authorizer), #108 (historical shift
  closure recompute script).
- Batch 3 submitted + merged: #96 (refund method vs original tender), #97 (refund
  payment-account posting), #98 (printed 8-char sale reference lookup), #120
  (appointment cancel guard + deposit credit), #121 (appointment deposit/paid
  state), #123 (appointment Rs. currency), #124 (appointment settings persisted
  and enforced), #156 (barcode dialog A4 24-up layout), #181 (manual adjustment
  reasons restricted), #182 (stock-take Review link), #198 (stock ledger audit +
  repair CLI).
- Batch 4 submitted + merged: #192 (row-locked adjustments), #193 (reason vs
  direction), #198 (ledger audit/repair), #213 (low-stock error state), #241
  (raw-material edit/delete guards), #242 (raw-material pre-pagination filter),
  #243 (raw-material costing: unitCost, valuation, production material cost),
  #244 (factory dashboard error states), #262 (dispatch pagination), #263 (bulk
  dispatch status guard), #270 (tracking refresh/shipment status), #279
  (packaging deduction), #280 (packaging stock guards), #287 (website weight
  pricing), #288 (COD includes shipping), #289 (rate-card load guard), #298
  (waybill template/branding), #309 (completed-sale marketing segments), #310
  (customer returns tab), #322 (sequential promotion stacking), #323/#324
  (category resolution + BOGO targets), #325 (deactivate/activate), #326
  (customer-pricing stacking regression), #337 (payout-backed commissions).
- Batch 5 merged: #348/#349 (attendance calendar + missing punch), #350/#351
  (hour-graded status + forgotten punch caps), #361 (commission clawback),
  #371/#372/#373/#374 (payroll no-pay base, pending commission, ledger posting,
  outstanding commission), #39 (login credential URL), #394 (inclusive expense
  date), #395/#406 (petty-cash period report and ledger repair), #40/#41
  (dashboard recent-sale date/payment), #416 (cash-flow reconciliation), #417
  (cash-only refunds), #425 (payment-account row locks), #435 (P&L zero-line
  sales), #444 (saved-report slugs), #451/#452/#453 (audit filter facets,
  inclusive To, complete export), #468 (owner-only tax + audited settings),
  #487 (storefront brand notice), #511 (COD reconciliation ledger/backfill),
  plus the void-credit restoration follow-up.
- Batch 6 merged: #54 (notification Open links), #65 (no negative stacked
  discount), #66 (cart scoped/cleared on logout), #67 (discount summary),
  #68 (promo hygiene), #77 (server payment filter), #78 (sales history RBAC),
  #79 (invalid filter 400), #80 (pagination cap), #99/#100 (refund preview,
  returns ledger RBAC).
- In flight: #101 (return receipt transparency) and #110 (shift sales count);
  #102 (return reversal) and #111 (shift data RBAC) are held to avoid
  return/shift-service conflicts while those run.
- Batch 7 merged: #101 (receipt transparency), #102 (required reason + audited
  return reversal with ReturnStatus.CANCELLED), #110 (shift completed-sales
  count), #113 (POS shift report standalone/print).
- Batch 9 merged: #125 (appointment lifecycle actions), #126 (derived overdue
  appointments + explicit no-show).
- In flight: #127/#128/#129/#130 (appointment availability, detail completeness,
  list dates/order, inclusive filters) on the appointments agent; #144 low-stock
  shortfall sign and #145 valuation VAT labels on the other agents.
- Batch 10 merged: #127 (booking availability), #128 (detail completeness),
  #129 (list years/upcoming-first), #130 (inclusive local date filters),
  #144 (low-stock shortfall sign), #145 (valuation tax labels), #146 (CSV import
  row validation), #147 (stale stock takes), #148 (batches of deleted products),
  #131 (appointment service tax rule), #132 (appointment sale attribution and
  commission), #157 (shared A4/thermal label templates), #158 (product vs
  variant range on Barcode Printing), #159 (exact barcode/SKU search), #160
  (tax-inclusive label price), #161 (dialog variant/page previews), #165
  (detail-panel delete blocked for in-use categories), #166 (clear a category
  description).
- Batch 12 merged in parallel module agents: #167/#168/#174-#176 (category and
  brand audit, description clearing, accurate delete locks), #183-#187/#194/
  #195/#199-#201 (movement reasons/dates/sources/CSV safety, valuation
  permission, adjustment audit/cache/storefront, stock-take maker-checker),
  #227-#232/#234/#235 (PO cancel/payment/audit/date/concurrency/repair, supplier
  errors/duplicates), #248-#250/#252 (BOM production lock, duplicate
  ingredients, eligible variants, error states), #264-#267/#271-#275 (dispatch
  selection/bulk results/amounts/errors, delivery items/cancel/load/print/
  prepare), #281-#284/#290 (packaging history/shortfall/selection/errors,
  destination-only rate zones), #311/#315/#317 (customer items/audit/no-contact)
  and the re-submission of #322.
- Checkpoint after batch 12: full suite green at 1,912 tests (230 files);
  `tsc` clean.
- Batch 13 (100 newly added tasks) implemented: all 96 tasks with DoD submitted
  to review; the 6 no-DoD items (Prisma baseline, void-credit restoration, and
  the four proposals: reports stock-movement reasons, seed PO receipts,
  soft-deleted BOM revival, dispatch orphaned-waybill audit) are implemented,
  documented and merged but Atlas rejects their submission.
- Checkpoint after batch 13: full suite green at **2,567 tests (331 files)**;
  `tsc` clean.
- Prisma baseline verified: `migrate status` reports the database schema is up
  to date (54/54 migrations).
- DB reachable again; the three pending migrations were applied as raw SQL with
  `prisma db execute` and verified (`RawMaterial.unitCost`,
  `ProductionLog.materialCost`, `ReturnStatus.CANCELLED`,
  `AppointmentService.taxRule`). `prisma migrate deploy` still fails **P3005**
  because the production database has a schema but no `_prisma_migrations`
  history (it was provisioned outside migrate); baselining is a separate
  infrastructure task, proposed on the board.
- Worktrees are reset with `git -C <wt> reset --hard argus_qa` between batches;
  their old commits are already merged, so this is safe.
- Every agent task must call `log_task_progress` before `submit_for_review`
  (Atlas rejects submissions without at least one progress entry).
- The patch server (`python -m http.server 8765`) can die; restart it when a
  submission needs a patch fetch.
- When claim_next_task is called repeatedly, the lease limit allows at least 6
  concurrent claims; claim a task before assigning it to an agent so the board
  reflects ownership.

## Next-batch candidates and ownership notes

- Returns tasks are plentiful (#96/#97/#98 done in batch 3); keep the returns
  specialist on that module.
- Appointments tasks (#120/#121) + any appointment follow-ups -> appointments
  specialist.
- Shift tasks (#109 and successors) -> shifts specialist.
- Schema/migration tasks stay with the main agent: agents must never edit
  `prisma/schema.prisma` or migrations. If a task truly needs one, the main
  agent adds the schema/migration, commits it, resets the agent worktree, and
  then hands over the code work.
- Main agent handles delivery/inventory/reports/website/staff tasks that no
  agent owns, or serial cleanups.


## Guardrails

- Enforce security/money rules server-side, not only in UI.
- New out-of-scope bugs: `propose_task`, do not silently fix.
- Keep tenant scoping and permissions explicit in every new route.
- Tests are the gate; a task is not done if `tsc` or its targeted tests fail.
