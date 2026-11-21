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
| sales | `C:\Users\Tuf\.local\share\opencode\worktree\b4adbd\agent-sales` | `agent/agent-sales` | Notifications & sale alerts: `erp/src/app/(store)/notifications/**`, `erp/src/lib/services/notification*`, sale void route/audit |
| pos | `...\agent-pos` | `agent/agent-pos` | POS cash tender: `erp/src/lib/services/sale.service.ts`, `erp/src/components/pos/CashPaymentModal.tsx`, `SplitPaymentModal.tsx`, related core tests |

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

## Batch progress log

- Batch 1 submitted + merged: #37, #38, #52, #62, #63 (test-only regression),
  #64 (cart stock cap, done serially by main).
- Batch 2 submitted + merged: #75 (sale detail breakdown), #76 (zero-line sales
  invariant + repair script), #95 (return authorizer), #108 (historical shift
  closure recompute script).
- Batch 3 in flight (agents): returns specialist -> #96, #97, #98; appointments
  specialist -> #120, #121; shifts specialist -> #109.
- Current main checkpoint SHA after batch 2: see `git log --oneline -1`.
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
