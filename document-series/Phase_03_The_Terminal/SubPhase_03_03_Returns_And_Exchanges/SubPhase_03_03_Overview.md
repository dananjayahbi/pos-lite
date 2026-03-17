# SubPhase 03.03 — Returns and Exchanges

## Metadata

| Field             | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| SubPhase ID       | 03.03                                                       |
| Name              | Returns and Exchanges                                       |
| Phase             | Phase 03 — The Terminal                                     |
| Status            | Not Started                                                 |
| Complexity        | High                                                        |
| Estimated Tasks   | 12                                                          |
| Dependencies      | SubPhase_03_01 complete, SubPhase_03_02 complete            |

---

## Objective

Complete the post-sale refund, return, and exchange workflow for VelvetPOS. This SubPhase delivers a fully audited, multi-step return experience covering every post-sale scenario a boutique clothing retailer encounters: straightforward cash refunds, card reversals, store credit issuance, and item exchanges. Every return is gated behind mandatory Manager PIN authorization, reusing `CartManagerPINModal` from SubPhase_03_01 to ensure accountability on every interaction.

The SubPhase also delivers automated inventory restocking (per line, inside the same Prisma transaction), return receipts dispatched via WhatsApp and print, a Return History page filterable by date range and refund method, and a Z-Report page that surfaces return totals alongside sales totals at end-of-shift.

---

## In Scope

- Return, ReturnLine, and StoreCredit Prisma models with all supporting enums (`ReturnRefundMethod`, `ReturnStatus`)
- `Sale.linkedReturnId` — new nullable FK on the existing Sale model to track exchange origin
- `return.service.ts` — service layer covering eligibility validation, proportional refund computation, transactional creation with per-line restocking, and store credit issuance
- `ReturnWizardSheet` — a 3-step right-side ShadCN Sheet driving the full return flow: item selection → refund options → manager authorization
- Exchange flow — implemented as return-then-pre-populate-cart, with the link tracked via `Sale.linkedReturnId`; no separate Exchange model exists
- Return API routes: POST /api/returns, GET /api/returns, GET /api/returns/[id]
- Return History page at `/pos/returns` listing completed returns with badges and a detail modal
- Manager PIN reuse — `CartManagerPINModal` integrated into the wizard's Step 3 authorization step
- Return receipt generation and dispatch (WhatsApp message body + thermal/browser print)
- Z-Report shift summary page showing gross sales, total returns, net sales, cash reconciliation, and discount summary
- Demo seed data covering at least 3 completed returns across different refund methods

---

## Out of Scope

- Store credit redemption at the POS checkout step (deferred to Phase 04 — Customer CRM)
- Customer CRM linking via `StoreCredit.customerId` (field is nullable and unused in Phase 03; Phase 04 populates it)
- Supplier returns / purchase-order return flows (Phase 04 — Inventory)
- Cross-tenant return analytics or aggregate reporting (Phase 05)
- Configurable return window per tenant or per product category (Phase 03 hard-codes 30 days)
- Proportional split-refund for original split-payment sales (cashier chooses a single refund method)

---

## Technical Context

### The Exchange-as-Return-then-New-Cart Pattern

VelvetPOS does not model exchanges as a first-class database entity. There is no `Exchange` table. Exchanges are fully tracked through `Sale.linkedReturnId`, a nullable FK added to the Sale model in this SubPhase. This keeps the data model minimal and avoids a complex two-headed transaction that would need to atomically finalize both a return and a new sale simultaneously.

The flow proceeds as follows:

- The cashier selects items to exchange and chooses Exchange as the refund method in the wizard.
- On manager PIN confirmation, POST /api/returns is called with `refundMethod = EXCHANGE`. The return record is created, restocking occurs, and a `refundAmount` is computed as normal.
- Instead of showing a return receipt dialog, the system redirects to the POS terminal and injects `{ linkedReturnId, exchangeCredit }` into the Zustand cart store.
- The cashier adds replacement items. The CartPanel shows a green "Exchange Mode" banner, and the payment step deducts `exchangeCredit` from the cart total automatically.
- When the exchange sale completes, POST /api/sales receives `linkedReturnId`, which is persisted to `Sale.linkedReturnId` — creating the permanent audit link between the return and the replacement sale.

If the customer leaves before completing the replacement cart, the return is already permanently recorded. The exchange credit remains in cart state (Zustand + IndexedDB) until the cart is completed or manually cancelled. Cancelling an exchange cart does NOT reverse the return — staff must contact a manager.

### Manager PIN Is Always Mandatory

Unlike other manager-override flows in the system (which may be conditional on role or threshold), return authorization requires a manager PIN without exception. There is no flow where a cashier completes a return unilaterally. This is enforced at the API layer: POST /api/returns validates that `authorizedById` refers to a user with the `MANAGER` or `SUPER_ADMIN` role and that the PIN hash matches before any write occurs.

### isRestocked — Per-Line Transactional Safety

Within `initiateReturn`, each `ReturnLine.isRestocked` is initialized to `false` at creation. After each `adjustStock` call succeeds for a line, that line's `isRestocked` is updated to `true` inside the same Prisma `$transaction`. If the transaction rolls back for any reason, all `isRestocked` values remain `false`. This means `isRestocked` is the canonical record of which lines were actually restocked — it is never a derived computation, and it never needs to be reconciled against stock movement history.

---

## Task Breakdown

| Task ID  | Name                                     | Complexity | Dependencies                           |
| -------- | ---------------------------------------- | ---------- | -------------------------------------- |
| 03.03.01 | Create_Return_And_StoreCredit_Models     | MEDIUM     | SubPhase_03_01, SubPhase_03_02         |
| 03.03.02 | Build_Return_Service_Layer               | HIGH       | 03.03.01                               |
| 03.03.03 | Build_Return_Initiation_Flow             | MEDIUM     | 03.03.02                               |
| 03.03.04 | Build_Return_Item_Selection_Panel        | MEDIUM     | 03.03.03                               |
| 03.03.05 | Build_Return_Refund_Options              | LOW        | 03.03.04                               |
| 03.03.06 | Build_Exchange_Flow                      | HIGH       | 03.03.05                               |
| 03.03.07 | Build_Return_API_Routes                  | HIGH       | 03.03.02                               |
| 03.03.08 | Build_Return_History_Page                | MEDIUM     | 03.03.07                               |
| 03.03.09 | Build_Manager_Authorization_Reuse        | LOW        | 03.03.03                               |
| 03.03.10 | Build_Return_Receipt_Dispatch            | MEDIUM     | 03.03.07                               |
| 03.03.11 | Build_Z_Report_Page                      | MEDIUM     | 03.03.08                               |
| 03.03.12 | Seed_Demo_Returns_Data                   | LOW        | 03.03.01                               |

---

## Validation Criteria

- [ ] Return, ReturnLine, and StoreCredit tables exist in the database and are visible in Prisma Studio
- [ ] `ReturnRefundMethod` and `ReturnStatus` enums are present in `schema.prisma`
- [ ] `Sale.linkedReturnId` nullable FK is present in the schema and resolves without error in queries
- [ ] `initiateReturn` creates Return, ReturnLine, and any StoreCredit records inside a single `$transaction`; any error rolls back all writes
- [ ] `adjustStock` is called per line and `isRestocked` is set to `true` on each `ReturnLine` only after that line's stock adjustment succeeds
- [ ] POST /api/returns returns 401 for an unauthenticated caller and 422 when the 30-day return window is expired
- [ ] POST /api/returns returns 403 when `authorizedById` fails PIN verification or does not have MANAGER/SUPER_ADMIN role
- [ ] The Return Items button on Sale History is disabled with a tooltip for sales older than 30 days
- [ ] The Return Items button shows "Fully Returned" and is disabled when all lines have zero returnable quantity
- [ ] Manager PIN step in the wizard uses `CartManagerPINModal` and populates `authorizedById` in wizard state on success
- [ ] Exchange mode banner appears in CartPanel when `linkedReturnId` is present in the Zustand cart store
- [ ] Return receipt (WhatsApp body + print layout) is generated and shown after a successful return

---

## Files Created in This SubPhase

- `prisma/schema.prisma` — updated with Return, ReturnLine, StoreCredit models and enums
- `prisma/migrations/[timestamp]_add_return_and_storecredit_models/migration.sql` — migration file
- `src/lib/services/return.service.ts` — full return service layer
- `src/app/api/returns/route.ts` — POST (create return), GET (list returns)
- `src/app/api/returns/[id]/route.ts` — GET (single return with lines)
- `src/components/pos/ReturnWizardSheet.tsx` — 3-step return wizard shell
- `src/components/pos/ReturnItemSelectionPanel.tsx` — Step 1 (item selection)
- `src/components/pos/ReturnRefundOptionsStep.tsx` — Step 2 (refund method)
- `src/components/pos/ReturnAuthorizationStep.tsx` — Step 3 (manager PIN via CartManagerPINModal)
- `src/app/(pos)/returns/page.tsx` — Return History page
- `src/app/(pos)/shift/z-report/page.tsx` — Z-Report page
- `src/lib/receipt/returnReceipt.ts` — Return receipt generator
- `prisma/seeds/returns.seed.ts` — Demo return seed data


---

## Scope

### In Scope

- **Data models**: Return, ReturnLine, and StoreCredit Prisma models and the associated Prisma migration.
- **Sale model update**: A new nullable `linkedReturnId` foreign key added to the Sale model to track exchanges.
- **Return service layer**: `src/lib/services/return.service.ts` encapsulating all return business logic including return-window validation, returnable-quantity tracking, stock restatement via `adjustStock`, and store credit creation.
- **Return initiation UI**: A "Process Return" action button on the Sale History page that opens the multi-step `ReturnWizardSheet`.
- **Item selection panel** (Step 1 of the wizard): Per-line return quantity selection, "already returned" visibility, and a global restock toggle.
- **Refund options panel** (Step 2 of the wizard): Refund method selection (CASH, CARD_REVERSAL, STORE_CREDIT, or Exchange), reversal reference number input for card reversals, and computed refund total display.
- **Exchange flow**: Return processing followed immediately by pre-populating a new POS cart in "Exchange mode" with a linked return ID and an applied return credit deduction.
- **Manager PIN authorization** (Step 3 of the wizard): Mandatory for all returns, reusing `CartManagerPINModal` from SubPhase 03.01 with a 5-minute authorization window.
- **Return API routes**: `POST /api/returns`, `GET /api/returns`, `GET /api/returns/[id]`, and `GET /api/returns/[id]/receipt`.
- **Return History page**: A paginated, filterable table at `/dashboard/[tenantSlug]/pos/returns` showing all returns with refund method badges and a detail modal per row.
- **Return receipt dispatch**: A `ReturnReceiptDialog` with WhatsApp and print actions after a return is processed.
- **Z-Report page**: A comprehensive shift summary at `/dashboard/[tenantSlug]/pos/shift-close` generated from `ShiftClosure` data, including cash reconciliation, returns breakdown, and discount summary.
- **Demo return seeding**: Extending `prisma/seed.ts` to create representative return and store credit records for the dev tenant.

### Out of Scope

- **Store credit redemption at POS**: Customers cannot apply store credit as a payment method at checkout. This functionality belongs to Phase 04 (CRM and Customer Loyalty).
- **Customer linking for store credit**: The `StoreCredit.customerId` field is nullable in Phase 03. Full customer profile association is a Phase 04 concern.
- **Supplier returns**: Returning stock to suppliers (as opposed to customer returns) is a separate workflow deferred to Phase 04.
- **Cross-tenant return analytics**: Aggregate return reporting across tenants is a Phase 05 concern.
- **Automated return eligibility rule engine**: Advanced configurable rules (e.g., category-level return windows, condition grading) are out of scope. Phase 03 uses a flat 30-day return window hardcoded at the service layer.
- **Partial refund for split payments**: When a sale was paid via split (cash + card), Phase 03 does not auto-split the refund proportionally. The cashier selects a single refund method.

---

## Technical Context

### Return Model Design

The Return model captures the authoritative record of a post-sale return event. It is always scoped to a tenant (`tenantId`) and always tied to an original completed sale (`originalSaleId`). Every return requires both an initiating actor (`initiatedById`) and an authorizing manager (`authorizedById`) — these may be the same person if the initiating cashier is also a manager. The `authorizedById` is not optional; it is enforced at both the API layer (Zod schema validation) and the service layer.

The `status` field on a Return is an enum with two values: `COMPLETED` (the common case — all requested lines were returned) and `PARTIALLY_RETURNED` (a label reserved for edge cases where individual line quantities were partially returned, though in practice every return transaction in Phase 03 is stamped `COMPLETED` at creation time since partial returns are expressed through line-level quantities rather than a multi-step approval workflow). There is no pending or approval state — returns are immediate upon Manager PIN authorization.

The `refundMethod` determines what happens after the Return record is created: cash is disbursed from the drawer, a card reversal is manually noted with a reference number, or a `StoreCredit` record is created.

### ReturnLine Immutability and isRestocked Flag

`ReturnLine` records are immutable after creation. The `isRestocked` boolean is stored explicitly on each line rather than computed dynamically from inventory state because it serves as a transaction-level receipt: it proves that `adjustStock` was called successfully for that specific line in that specific return transaction. If a database transaction partially fails (the `ReturnLine` row commits but the `adjustStock` call throws before updating stock), the presence of `isRestocked=false` on that line means the inventory restatement is known to be incomplete, allowing an operator to manually reconcile. Setting `isRestocked=true` happens within the same transaction as the `adjustStock` call, making it a reliable state signal rather than a derived computation.

### Exchange-as-Return-Then-New-Cart Pattern

VelvetPOS does not model exchanges as a first-class database entity. Instead, an exchange is the composition of two atomic operations: a completed Return (with `refundMethod` conceptually treated as "exchange credit") followed by a new POS cart pre-populated with a `linkedReturnId` reference. The new sale, when completed, will carry `Sale.linkedReturnId` pointing to the originating Return. This design means the exchange is fully auditable through the existing Return and Sale models without requiring a third entity. The `ReturnWizardSheet` exposes "Exchange Items" as a fourth option alongside the three monetary refund methods, but it resolves to the same `POST /api/returns` call — the only difference is the UI behaviour afterward (opening a new cart in exchange mode instead of a receipt dialog).

### Manager PIN Requirement

All returns in VelvetPOS require Manager PIN authorization without exception. This is a non-negotiable business rule reflecting the financial sensitivity of return operations in a clothing retail context. The `CartManagerPINModal` component built in SubPhase 03.01 for optional cart discounts is reused here, but configured without a "Skip" option and with a step label tailored to the return context. The authorization produces a `userId` and `role` from the `/api/auth/verify-pin` endpoint. The `userId` is stored as `authorizedById` on the Return record. The authorization token (stored in wizard state alongside a timestamp) expires after 5 minutes to prevent a scenario where a manager walks away after authorizing but the cashier has not yet submitted the return.

### StoreCredit Model

The `StoreCredit` model is created in this SubPhase to support the store credit refund path, but it is intentionally minimal in Phase 03. The `customerId` field is nullable because full customer profile management belongs to Phase 04. In Phase 03, store credit exists as a balance record that can be issued but not yet redeemed at the POS terminal. The `usedAmount` field defaults to zero and will be incremented by Phase 04's redemption flow. The `expiresAt` field is nullable and is not enforced in Phase 03.

### Z-Report and ShiftClosure

The Z-Report is a printed/displayable shift summary generated from the `ShiftClosure` record created when a cashier closes their shift (built in SubPhase 03.01). The report consolidates sales totals, return totals, cash reconciliation (expected vs. actual cash in drawer), and discount totals. The page at `/dashboard/[tenantSlug]/pos/shift-close` serves dual duty: before shift close, it renders the "Close Shift" action; after close, it renders the completed Z-Report as a read-only document. The print path uses `@media print` CSS, consistent with the receipt printing pattern established in SubPhase 03.02.

### Monetary Arithmetic

All monetary values across returns, refund amounts, and store credit balances use `Decimal` (precision 12, scale 2) in the Prisma schema and `decimal.js` at the service layer for arithmetic, consistent with the convention established across Phase 03.

---

## Task List

| Task ID    | Task Name                              | Complexity | Dependencies                          |
|------------|----------------------------------------|------------|---------------------------------------|
| 03.03.01   | Create Return and StoreCredit Models   | Medium     | 03.01.01, 03.02.01                    |
| 03.03.02   | Build Return Service Layer             | High       | 03.03.01                              |
| 03.03.03   | Build Return Initiation Flow           | Medium     | 03.03.01, 03.01 Sale History page     |
| 03.03.04   | Build Return Item Selection Panel      | Medium     | 03.03.03                              |
| 03.03.05   | Build Return Refund Options            | Medium     | 03.03.04                              |
| 03.03.06   | Build Exchange Flow                    | High       | 03.03.05, 03.01 Cart                  |
| 03.03.07   | Build Return API Routes                | Medium     | 03.03.02                              |
| 03.03.08   | Build Return History Page              | Medium     | 03.03.07                              |
| 03.03.09   | Build Manager Authorization Reuse      | Low        | 03.01.09, 03.03.03                    |
| 03.03.10   | Build Return Receipt Dispatch          | Medium     | 03.03.07, 03.02 Receipt components    |
| 03.03.11   | Build Z-Report Page                    | High       | 03.01 ShiftClosure, 03.03.07          |
| 03.03.12   | Seed Demo Returns Data                 | Low        | 03.03.01, 03.02.12                    |

---

## Validation Criteria

- [ ] Running `pnpm prisma migrate dev --name add_return_and_storecredit_models` applies without errors and all Return, ReturnLine, and StoreCredit tables are visible in Prisma Studio.
- [ ] `Sale.linkedReturnId` nullable foreign key is present in the database schema.
- [ ] Calling `return.service.initiateReturn` with a sale older than 30 days throws a validation error and no Return record is created.
- [ ] Calling `return.service.initiateReturn` with a return quantity exceeding the remaining returnable quantity throws a validation error.
- [ ] A successful return with `restockItems=true` results in `ReturnLine.isRestocked=true` for each line and increased `ProductVariant.stockQuantity` values visible in Prisma Studio.
- [ ] A `POST /api/returns` request without a valid `authorizingManagerId` returns a 403 response.
- [ ] The "Process Return" button on the Sale History page is disabled with a tooltip when the sale is outside the 30-day return window or is fully returned.
- [ ] The `ReturnWizardSheet` blocks progression to Step 3 (Manager PIN) if no items have a return quantity greater than zero.
- [ ] After a STORE_CREDIT return, a `StoreCredit` record with the correct amount is visible in Prisma Studio for the tenant.
- [ ] The Exchange flow opens a new POS cart with `linkedReturnId` set and displays the green "Exchange mode" banner and the "Applied Return Credit" deduction.
- [ ] The Return History page at `/dashboard/[tenantSlug]/pos/returns` loads without error, displays paginated results, and the refund method badges render with the correct colours.
- [ ] The Z-Report page displays all required sections (sales summary, returns summary, cash reconciliation, discounts) and the print action produces a clean printed layout.

---

## Files Created / Modified

| File Path                                                      | Action   | Description                                          |
|----------------------------------------------------------------|----------|------------------------------------------------------|
| `prisma/schema.prisma`                                         | Modified | Add Return, ReturnLine, StoreCredit models; add Sale.linkedReturnId |
| `prisma/migrations/.../migration.sql`                          | Created  | Auto-generated migration for new models              |
| `src/lib/services/return.service.ts`                           | Created  | All return business logic                            |
| `src/app/api/returns/route.ts`                                 | Created  | POST and GET /api/returns                            |
| `src/app/api/returns/[id]/route.ts`                            | Created  | GET /api/returns/[id]                                |
| `src/app/api/returns/[id]/receipt/route.ts`                    | Created  | GET /api/returns/[id]/receipt                        |
| `src/components/pos/ReturnWizardSheet.tsx`                     | Created  | Multi-step return wizard (sheet container)           |
| `src/components/pos/ReturnItemSelectionPanel.tsx`              | Created  | Step 1: item and quantity selection                  |
| `src/components/pos/ReturnRefundOptions.tsx`                   | Created  | Step 2: refund method selection                      |
| `src/components/pos/ReturnReceiptDialog.tsx`                   | Created  | Post-return receipt dialog with WhatsApp and print   |
| `src/components/pos/ExchangeModeBanner.tsx`                    | Created  | Green banner shown in exchange-mode cart             |
| `src/app/dashboard/[tenantSlug]/pos/returns/page.tsx`          | Created  | Return History page                                  |
| `src/app/dashboard/[tenantSlug]/pos/shift-close/page.tsx`      | Created  | Z-Report / shift close page                          |
| `src/components/pos/ZReport.tsx`                               | Created  | Z-Report display component                          |
| `prisma/seed.ts`                                               | Modified | Add demo returns, return lines, and store credit     |
