# 38 — Expense Receipt Upload

**Module:** M12 — Petty Cash Management
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md), [37-petty-cash-categories](./37-petty-cash-categories.md)

## Issue / Current State
The `Expense` model (`erp/prisma/schema.prisma`) has a `receiptImageUrl` field, but it is populated only as a manually entered text URL in the expenses form at `erp/src/app/(store)/expenses/page.tsx`. There is no file-upload capability wired to the expense form — a staff member must already have a hosted image URL and paste it in, which in practice means receipts are rarely attached.

Meanwhile, the codebase already has working upload infrastructure: `erp/src/app/api/store/upload/` contains sub-routes such as `brand-logo/` and `category-image/` that accept and store uploaded files. That existing mechanism is not reused for expense receipts.

## Impact
Without a straightforward upload, receipt evidence for petty-cash expenses is largely absent. This weakens accountability and auditability — disputes about spending are hard to resolve, and the owner cannot visually verify purchases. It also undermines the export report (doc 41), which would otherwise be able to include receipt references.

## Implementation Plan
### Step 1 — Add a receipt upload route
Add a new upload route under `erp/src/app/api/store/upload/` (e.g., `receipt/`) that mirrors the existing `brand-logo/` and `category-image/` routes: validate file type/size, store the file, and return a public URL. Follow the same authorization and storage conventions as the existing upload routes.

### Step 2 — Build a reusable receipt-upload component
Create a small, reusable upload control (e.g., under `erp/src/components/expenses/`) that lets a user pick an image, uploads it to the new route, and returns the resulting URL. It should show progress and a preview, allow re-upload/replacement, and expose the final `receiptImageUrl`.

### Step 3 — Wire it into the expense form
Integrate the upload component into the expense create/edit form at `erp/src/app/(store)/expenses/page.tsx`, replacing the manual text field for `receiptImageUrl`. When the user saves, the returned URL is stored on the `Expense` record. Keep the manual URL field as an advanced fallback if needed.

### Step 4 — Display receipts on the expense record
Update the expense list/detail display to render an attached receipt (thumbnail/link) from `receiptImageUrl`, so attached evidence is visible without opening a raw URL. This could also feed the export report in doc 41.

## Dependencies
- [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md) — standalone fund expenses benefit from attached receipts.
- [41-petty-cash-export](./41-petty-cash-export.md) — can include receipt references.
- Existing upload infrastructure at `erp/src/app/api/store/upload/` and `Expense.receiptImageUrl`.

## Files / Areas affected
- New upload route under `erp/src/app/api/store/upload/` (e.g., `receipt/route.ts`).
- New reusable upload component under `erp/src/components/expenses/`.
- `erp/src/app/(store)/expenses/page.tsx` — form wiring and receipt display.
- `Expense` model — no schema change required (`receiptImageUrl` already exists).
