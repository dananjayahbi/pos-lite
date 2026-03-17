# SubPhase 04.02 — Staff, Promotions and Expenses

## Metadata

| Field | Value |
|---|---|
| SubPhase ID | 04.02 |
| SubPhase Name | Staff, Promotions and Expenses |
| Phase | 04 — The Operations |
| Status | Planned |
| Depends On | Phase 03 complete (Sale, Return, Shift, Z-Report), SubPhase 04.01 (Reporting and Analytics) |
| Estimated Complexity | Very High |
| Task Count | 12 |
| Primary Technologies | Prisma ORM, Next.js 15 App Router, TypeScript strict, Zustand, TanStack Query, ShadCN/UI |

---

## Objective

SubPhase 04.02 extends VelvetPOS with the operational infrastructure that connects staff activity directly to financial outcomes. It introduces a commission tracking system that records earnings at the point of sale and adjusts them on returns, a PIN management and time-clock feature for workforce accountability, a promotions engine capable of evaluating multiple concurrent discount strategies at cart-calculation time, and an expense and cash-flow ledger that gives operators a complete view of daily financial health.

Together these twelve tasks transform VelvetPOS from a transaction-capturing system into one that actively manages the human and financial dimensions of retail operations.

---

## Scope

### In Scope

- Seven new Prisma models: CommissionRecord, CommissionPayout, TimeClock, Promotion, CustomerPricingRule, Expense, and CashMovement
- New fields on existing models: User.commissionRate, User.clockedInAt, and Sale.appliedPromotions
- Staff management UI with role badges, active/inactive toggles, and a tabbed detail view
- PIN management flow enabling Managers and Owners to set or reset staff PINs securely
- Commission service layer covering creation, return-reversal, payout aggregation, and reporting
- Commission reports page with period filters and a manager-level Mark as Paid action
- Time clock feature allowing staff to record shift start and end from the dashboard
- Promotions service layer implementing a prioritised evaluation engine and promo code validation
- Promotions management UI with PromotionType-aware form rendering
- POS terminal cart integration that evaluates promotions on every cart change
- Expense logger with category filtering, receipt image upload, and per-category summary rows
- Cash flow statement combining sale income, expense totals, and cash movements for a selected period
- Idempotent seed data for demo commissions, promotions, expenses, and cash movements

### Out of Scope

- Integration with external payroll or HR systems
- Tax calculation applied to commission payouts or expense records
- Advanced loyalty points programs (handled in a later subphase)
- Inventory valuation or stock cost adjustments (Phase 02)
- Commission structures beyond flat percentage (tiered or milestone-based)

---

## Technical Context

This subphase builds directly on the Phase 03 terminal layer. The Sale model's salespersonId and shiftId fields, the Return model, and the Shift model's opening-float fields are all required before any task in this subphase can be completed. Commission automation is implemented as a side effect inside the sale completion and return completion API routes — in both cases the commission service is called after the primary database transaction commits to avoid partial writes.

The promotions evaluation engine is designed with terminal responsiveness as the primary constraint. Evaluation is triggered client-side via a GET request to the promotions evaluate endpoint after every cart line change, and the resulting discount objects are stored in Zustand cart state. No blocking server logic should be inserted into the cart update path. Priority order for evaluation is: customer-specific pricing rules first, followed by category percentage discounts, then BOGO and mix-and-match rules, and finally cart-level promotions. Manual line discounts applied by a cashier in Phase 03 take precedence over promotion calculations — if a manual discount is present on a line, any promotion targeting that line is skipped and a note is surfaced to the cashier.

CustomerPricingRule matching uses the Customer.tags array field introduced in Phase 02. CashMovement augments the Shift model and feeds the Z-Report computation from Phase 03 with opening float, petty cash, and manual adjustment data. The Cash Flow Statement in task 04.02.11 aggregates Sale totals, CashMovement records, and Expense records for a date range, providing the operator with a reconciled daily or weekly financial picture.

---

## Task List

| Task ID | Task Name | Complexity | Dependencies |
|---|---|---|---|
| 04.02.01 | Create Staff Commission and Promotions Models | High | Phase 01 User, Phase 03 Sale / Shift / Return |
| 04.02.02 | Build Staff Management Pages | Medium | 04.02.01 |
| 04.02.03 | Build PIN Management UI | Medium | 04.02.02, Phase 01 NextAuth |
| 04.02.04 | Build Commission Service Layer | Very High | 04.02.01, Phase 03 Sale and Return APIs |
| 04.02.05 | Build Commission Reports Page | Medium | 04.02.04 |
| 04.02.06 | Build Time Clock Feature | Medium | 04.02.01, 04.02.02 |
| 04.02.07 | Build Promotion Service Layer | Very High | 04.02.01, Phase 02 Category, Phase 02 Customer |
| 04.02.08 | Build Promotions Management Page | High | 04.02.07 |
| 04.02.09 | Build POS Terminal Promotions Integration | High | 04.02.07, Phase 03 cart store and sale API |
| 04.02.10 | Build Expense Logger | Medium | 04.02.01 |
| 04.02.11 | Build Cash Flow Statement | Medium | 04.02.10, Phase 03 Shift and Z-Report |
| 04.02.12 | Seed Demo Staff and Promotions Data | Low | 04.02.01, Phase 01 seed, Phase 03 seed |

---

## Validation Criteria

- [ ] All seven new Prisma models are present in schema.prisma with correct field types, relations, and indexes
- [ ] Three new enums (PromotionType, ExpenseCategory, CashMovementType) are declared in schema.prisma
- [ ] Migration named add_staff_promotions_expenses_models applies cleanly on a fresh PostgreSQL database
- [ ] User.commissionRate is Decimal and nullable; User.clockedInAt is DateTime and nullable
- [ ] Sale.appliedPromotions is Json and nullable
- [ ] Staff list page renders role badges in the VelvetPOS palette and active/inactive toggle works correctly
- [ ] Staff detail page displays four tabs — Profile, PIN Management, Commission History, Time Clock — without layout errors
- [ ] Manager and Owner roles can set or reset a staff PIN; no PIN hash or cleartext PIN appears in any API response body
- [ ] Commission records are created on sale completion whenever the sale has a salespersonId
- [ ] Negative commission records are created on return completion when the originating sale had a salespersonId
- [ ] The createCommissionPayout function marks all qualifying unpaid records as paid within a single database transaction
- [ ] Promotions evaluate in correct priority order at cart-calculation time
- [ ] Promo code validation returns a structured discount on success and a structured error on failure
- [ ] The POS cart recalculates promotions after every cart line add, update, or remove action
- [ ] Expense logger creates, lists, and filters records correctly by category and date
- [ ] Cash flow statement totals match the arithmetic sum of filtered sale totals, expense amounts, and cash movement amounts for any given date range
- [ ] Seed script completes without errors and is fully idempotent across repeated executions

---

## Files Created or Modified

- prisma/schema.prisma — seven new models, three new enums, new fields on User and Sale
- prisma/migrations/[timestamp]_add_staff_promotions_expenses_models/migration.sql
- src/lib/services/commission.service.ts
- src/lib/services/promotion.service.ts
- src/app/api/staff/[id]/pin/route.ts
- src/app/api/timeclock/clock-in/route.ts
- src/app/api/timeclock/clock-out/route.ts
- src/app/api/promotions/evaluate/route.ts
- src/app/dashboard/[tenantSlug]/staff/page.tsx
- src/app/dashboard/[tenantSlug]/staff/[staffId]/page.tsx
- src/app/dashboard/[tenantSlug]/staff/[staffId]/components/PinManagement.tsx
- src/app/dashboard/[tenantSlug]/staff/[staffId]/components/CommissionHistory.tsx
- src/app/dashboard/[tenantSlug]/staff/[staffId]/components/TimeClockHistory.tsx
- src/app/dashboard/[tenantSlug]/staff/commissions/page.tsx
- src/app/dashboard/[tenantSlug]/promotions/page.tsx
- src/app/dashboard/[tenantSlug]/expenses/page.tsx
- src/app/dashboard/[tenantSlug]/expenses/cash-flow/page.tsx
- src/store/cart.store.ts — updated to store and recalculate promotions
- prisma/seed.ts — updated with demo commissions, promotions, expenses, and cash movements
