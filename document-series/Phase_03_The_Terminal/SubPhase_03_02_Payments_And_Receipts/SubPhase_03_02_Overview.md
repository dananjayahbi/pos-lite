# SubPhase 03.02 — Payments, Receipts & Offline Mode

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | 03.02 |
| Name | Payments, Receipts & Offline Mode |
| Phase | 03 — The Terminal |
| Status | Pending |
| Depends On | SubPhase_03_01 (POS Core) complete |
| Estimated Tasks | 12 |

## Objective

Complete the sale transaction lifecycle for the VelvetPOS terminal by introducing the Payment data model, building the three payment modals (cash, card, split), wiring the sale creation API with full atomic persistence, integrating WhatsApp receipt dispatch via the Meta Cloud API, building the thermal receipt HTML renderer, and implementing offline cart persistence with automatic sync-on-reconnect using IndexedDB.

By the end of this sub-phase, a cashier can complete a sale in any of the three supported payment modes, receive confirmation, dispatch a receipt to the customer via WhatsApp, and operate the terminal seamlessly even during brief connectivity interruptions.

## Scope

### In Scope

- Payment Prisma model and database migration
- payment.service.ts providing createPayment, getPaymentsForSale, and computeChange utilities
- Cash Payment Modal with live change calculation and banknote quick-select buttons
- Card Payment Modal with terminal reference number capture and a Phase 5 integration placeholder
- Split Payment Modal with card/cash allocation inputs and validation ensuring amounts sum correctly
- POST /api/sales route creating Sale, SaleLines, and Payment records atomically within a single Prisma transaction
- GET /api/sales and GET /api/sales/[id] routes with filter and pagination support
- PATCH /api/sales/[id]/void route for sale voiding
- GET /api/sales/[id]/receipt route returning thermal receipt HTML
- POST /api/sales/[id]/send-receipt route triggering WhatsApp dispatch via Meta Cloud API
- WhatsApp receipt dispatch integration (src/lib/whatsapp.ts)
- Receipt Preview Dialog shown after sale completion, presenting WhatsApp and print options
- Offline cart persistence via IndexedDB using the idb library (usePersistCartEffect)
- Offline sale queue with automatic sync on reconnect (useOfflineSync)
- Offline status badge in the POS terminal header
- POST /api/shifts, GET /api/shifts/current, POST /api/shifts/[id]/close, GET /api/shifts, GET /api/shifts/[id] route implementation
- Demo sales seed data: 20 completed sales across 5 days for the dev tenant

### Out of Scope

- Returns and refunds — deferred to SubPhase 03.03
- PayHere card gateway integration — deferred to Phase 05
- Printed receipts for returns — deferred to SubPhase 03.03
- Customer accounts and loyalty — deferred to Phase 04
- E-mail receipt dispatch — not in scope for Phase 03

## Technical Context

SubPhase 03.01 established the core POS Prisma models (Sale, SaleLine, Shift, ShiftClosure), the sale.service.createSale function signature, and the basic POS terminal layout shell. This sub-phase builds directly on top of those foundations.

The Payment model is a child of Sale and records individual payment legs. A split payment is represented as two Payment rows — one CASH and one CARD — linked to the same Sale whose paymentMethod is set to SPLIT. The atomicity invariant — the sum of all Payment amounts for a sale must equal Sale.totalAmount — is enforced inside the sale.service transaction, not as a database constraint, because Prisma does not support multi-row check constraints directly.

Offline mode is implemented in two layers. Cart persistence using IndexedDB via the idb library ensures that the cashier's in-progress cart survives an accidental browser refresh without any data loss. The offline sale queue handles the rarer but more critical scenario where a network outage occurs at the moment the cashier attempts to complete a sale — the payload is stored in IndexedDB and auto-submitted as soon as connectivity resumes.

WhatsApp dispatch uses the Meta Cloud API with pre-approved message templates. The integration is fire-and-forget from the sale-completion perspective: the sale is marked COMPLETED immediately, and a subsequent API call attempts to send the WhatsApp message. Failure of the WhatsApp dispatch never blocks or reverses the sale.

The thermal receipt is rendered as a plain HTML page optimised for 80mm thermal paper and uses @page CSS with window.print() triggered from the receipt URL in a new browser tab.

## Task List

| Task ID | Name | Complexity | Depends On |
|---|---|---|---|
| Task_03_02_01 | Create Payment Model | Low | SubPhase_03_01 complete |
| Task_03_02_02 | Build Payment Service Layer | Low | Task_03_02_01 |
| Task_03_02_03 | Build Cash Payment Modal | Medium | SubPhase_03_01 complete |
| Task_03_02_04 | Build Card Payment Modal | Medium | Task_03_02_03 |
| Task_03_02_05 | Build Split Payment Modal | High | Task_03_02_04 |
| Task_03_02_06 | Build Sale API Routes | High | Task_03_02_02 |
| Task_03_02_07 | Build WhatsApp Receipt Dispatch | Medium | Task_03_02_06 |
| Task_03_02_08 | Build Thermal Print Receipt | Medium | Task_03_02_06 |
| Task_03_02_09 | Build Receipt Preview Dialog | Medium | Task_03_02_07, Task_03_02_08 |
| Task_03_02_10 | Build Shift API Routes | Medium | SubPhase_03_01 complete |
| Task_03_02_11 | Implement Offline Mode Cart Persistence | High | SubPhase_03_01 complete |
| Task_03_02_12 | Seed Demo Sales Data | Low | Task_03_02_06 |

## Validation Criteria

- [ ] The `Payment` Prisma model is present in the schema with all required fields, the `PaymentMethod` enum is defined, and the migration `add_payment_model` has been applied without errors or drift warnings.
- [ ] `payment.service.createPayment` accepts an optional Prisma transaction client and is called correctly from within `sale.service.createSale`, with all payment records persisted atomically alongside the parent sale.
- [ ] The Cash Payment Modal renders the total due in JetBrains Mono, accepts a cash received value, displays correct change, disables the submit button when cash entered is less than the total due, and posts to `POST /api/sales` on confirm.
- [ ] The Card Payment Modal renders the total due, provides an optional terminal reference field, displays the info banner instructing the cashier to process on the physical card machine first, and posts to `POST /api/sales` on confirm.
- [ ] The Split Payment Modal correctly auto-computes the cash leg when the card amount changes, validates that the two amounts sum to the total within decimal precision using `decimal.js`, and the resulting sale persists exactly two `Payment` records — one `CARD` and one `CASH`.
- [ ] All five sale API routes respond with correct HTTP status codes, enforce role-based access control, and isolate all data queries and writes by `tenantId`.
- [ ] The WhatsApp dispatch function sends the correct template payload to the Meta Cloud API, formats Sri Lankan phone numbers with the `+94` prefix, updates `whatsappReceiptSentAt` on success, and does not block or error the sale flow on failure.
- [ ] `GET /api/sales/[id]/receipt` returns valid HTML formatted for 80 mm thermal printing, including all required sections — store header, line items, totals, payment summary, and footer — and the `@page` CSS ensures the print dialog targets the correct paper width.
- [ ] The Receipt Preview Dialog appears immediately after every successful sale, correctly displays change due for cash and split payments, allows WhatsApp receipt dispatch with error retry, and the "New Sale" button clears the cart and closes the dialog.
- [ ] All shift API routes (`POST /api/shifts`, `GET /api/shifts/current`, `POST /api/shifts/[id]/close`, `GET /api/shifts`, `GET /api/shifts/[id]`) return correct responses, validate open shift uniqueness, and enforce tenant isolation.
- [ ] `usePersistCartEffect` successfully serialises and restores cart state from IndexedDB on terminal mount after a full browser refresh; the amber "Offline" badge appears in the header within one second of `navigator.onLine` becoming false.
- [ ] The seed script generates 20 completed sales across 5 days with the correct payment method distribution (60% CASH, 30% CARD, 10% SPLIT), passes the idempotency check on re-run, and `pnpm prisma db seed` completes without errors.

## Files Created / Modified

**New Prisma migration:**
- prisma/migrations/[timestamp]_add_payment_model/migration.sql

**Schema:**
- prisma/schema.prisma (Payment model added, Sale relation updated)

**Services:**
- src/lib/services/payment.service.ts

**API routes:**
- src/app/api/sales/route.ts
- src/app/api/sales/[id]/route.ts
- src/app/api/sales/[id]/void/route.ts
- src/app/api/sales/[id]/receipt/route.ts
- src/app/api/sales/[id]/send-receipt/route.ts
- src/app/api/shifts/route.ts
- src/app/api/shifts/current/route.ts
- src/app/api/shifts/[id]/route.ts
- src/app/api/shifts/[id]/close/route.ts

**Integrations:**
- src/lib/whatsapp.ts

**Components:**
- src/components/pos/CashPaymentModal.tsx
- src/components/pos/CardPaymentModal.tsx
- src/components/pos/SplitPaymentModal.tsx
- src/components/pos/ReceiptPreviewDialog.tsx
- src/components/pos/OfflineStatusBadge.tsx

**Hooks:**
- src/hooks/usePersistCartEffect.ts
- src/hooks/useOfflineSync.ts

**Offline persistence:**
- src/lib/idb-store.ts

**Validation schemas:**
- src/lib/validation/sale.schema.ts
- src/lib/validation/shift.schema.ts

**Receipt renderer:**
- src/lib/receipt-renderer.ts

**Seed:**
- prisma/seed.ts (extended with demo sales data)

**Environment:**
- .env.example (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME added)
