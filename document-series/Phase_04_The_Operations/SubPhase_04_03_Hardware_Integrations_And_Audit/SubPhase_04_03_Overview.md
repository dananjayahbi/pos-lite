# SubPhase 04.03 — Hardware Integrations and Audit

## Metadata

| Field | Value |
|---|---|
| SubPhase ID | 04.03 |
| SubPhase Name | Hardware Integrations and Audit |
| Phase | 04 — The Operations |
| Status | Planned |
| Depends On | SubPhase 04.02, Phase 03 complete |
| Roles Affected | SUPER_ADMIN, OWNER, MANAGER, CASHIER |
| Estimated Tasks | 12 |

## Objective

SubPhase 04.03 rounds out the operational layer of VelvetPOS by connecting the POS terminal to physical hardware peripherals, wiring a comprehensive audit trail across all critical business mutations, delivering WhatsApp-based customer engagement automation, and closing the promotion evaluation loop inside the live POS cart. When complete, tenants can print receipts to a thermal printer, kick a cash drawer on every cash sale, display the live cart on a customer-facing second screen, review a full ledger of every significant change made in the system, and run targeted marketing broadcasts — all from within the same unified application.

## Scope

### In Scope

- Audit service layer providing createAuditLog and getAuditLogs, wired into all business-critical service files as a non-blocking fire-and-forget side effect
- Audit log viewer page with paginated table, multi-axis filters, and a before/after diff modal on row click
- ESC/POS thermal printer integration wrapping the escpos npm library — receipt printing and Z-Report printing
- Cash drawer kick integration wired automatically into cash sale completion and cash return refund flows
- Hardware settings page for configuring printer type, IP, port, cash drawer toggle, and CFD toggle
- Customer Facing Display full-screen route with three states (Idle, Active, Complete) subscribing to a Server-Sent Events cart stream
- SSE endpoint and POS cart broadcast mechanism for the CFD
- WhatsApp birthday automation cron endpoint designed for Vercel Cron Jobs
- Marketing broadcast builder with customer segment filters and sequential bulk WhatsApp send
- Promotion auto-apply evaluation endpoint wired into the POS cart store, with promo code input
- Shift petty cash (CashMovement) CRUD integrated into the Z-Report screen
- Demo seed data covering hardware config, audit log entries, and cash movement records

### Out of Scope

- Multi-printer support — only one printer configuration per tenant is supported in this phase
- Bluetooth or serial printer drivers — only NETWORK and USB escpos transport modes are covered
- WhatsApp message template management — message text is hardcoded in this phase
- Real-time multi-instance CFD via Redis pub/sub — the single-instance EventEmitter approach is documented with a known limitation
- Email marketing broadcasts — WhatsApp only in this SubPhase

## Technical Context

This SubPhase builds on the following foundations established in prior phases:

- The AuditLog Prisma model (id, tenantId, userId, action String, entityType String, entityId String, previousValues Json nullable, newValues Json nullable, ipAddress String nullable, userAgent String nullable, createdAt) was created in SubPhase 01.02 and has had no write callers until now
- The CashMovement Prisma model and ShiftSession model were defined in Phase 03
- The POS terminal CartPanel and cart Zustand store are fully operational from Phase 03
- The Promotions data model and promotion CRUD UI were completed in SubPhase 04.02
- The Z-Report page exists from SubPhase 03.01
- The Customer Prisma model will receive a new field in this SubPhase: lastBirthdayMessageSentYear (Int, nullable), added in Task 04.03.08 and referenced by Task 04.03.12

Hardware integration uses the escpos, escpos-network, and escpos-usb npm packages. All hardware calls must be made server-side inside API routes — these are Node.js-only libraries and must never be imported in client-side components or Server Components that run in the browser environment.

The CFD SSE endpoint uses a module-level Node.js EventEmitter. This works correctly in a single long-running Node.js server process (local development or a traditional deployment) but does not propagate events across independent serverless function instances. This single-instance limitation is explicitly documented and the production upgrade path via Redis pub/sub is noted for future reference.

WhatsApp integration assumes each tenant has already configured a valid WhatsApp Business API endpoint and bearer token in Tenant.settings.whatsapp, a field set up in SubPhase 04.01.

## Task List

| Task ID | Task Name | Complexity | Dependencies |
|---|---|---|---|
| 04.03.01 | Build Audit Service Layer | High | AuditLog model (01.02), all domain service files |
| 04.03.02 | Build Audit Log Viewer Page | Medium | 04.03.01 |
| 04.03.03 | Build ESC/POS Printer Integration | High | Tenant.settings.hardware shape |
| 04.03.04 | Build Cash Drawer Integration | Medium | 04.03.03 |
| 04.03.05 | Build Hardware Settings Page | Medium | 04.03.03, 04.03.04 |
| 04.03.06 | Build Customer Facing Display | Medium | 04.03.07 (SSE endpoint must exist first) |
| 04.03.07 | Build CFD SSE Endpoint | Medium | Phase 03 POS cart Zustand store |
| 04.03.08 | Build WhatsApp Birthday Automation | Medium | Customer model, Tenant.settings.whatsapp |
| 04.03.09 | Build Marketing Broadcast Builder | Medium | 04.03.08 context (WhatsApp send helper) |
| 04.03.10 | Build Promotion Auto-Apply in POS | High | Promotions model, POS CartPanel, cart Zustand store |
| 04.03.11 | Build Shift Petty Cash and Cash Movements | Medium | CashMovement model, Z-Report page (Phase 03) |
| 04.03.12 | Seed Demo Hardware and Audit Data | Low | All prior tasks in this SubPhase |

## Validation Criteria

- [ ] Calling createAuditLog from sale.service.ts after a COMPLETED sale does not block or fail the parent sale transaction when the audit write encounters an error
- [ ] The audit log viewer renders paginated results with working entity type, date range, and actor filters
- [ ] Clicking an audit log row opens a detail modal showing a human-readable before → after key-by-key diff view
- [ ] Running pnpm add escpos escpos-network escpos-usb completes without dependency conflicts
- [ ] printSaleReceipt fetches full sale line items and sends a correctly structured ESC/POS buffer to the configured printer
- [ ] printZReport fetches shift totals and sends a Z-Report ESC/POS buffer
- [ ] kickCashDrawer is invoked automatically when a CASH sale is marked COMPLETED
- [ ] kickCashDrawer is invoked automatically when a CASH return refund is processed
- [ ] The hardware settings page saves printer configuration to Tenant.settings.hardware via a PATCH request
- [ ] Test Print button triggers a successful POST to /api/hardware/test-print and shows a success toast
- [ ] The CFD page renders the Idle screen when the cart is empty and transitions to Active when items are added
- [ ] The SSE stream at /api/cfd/stream delivers cart update events from the POS terminal to the CFD page
- [ ] The birthday cron endpoint sends a WhatsApp message only to customers whose birthday month and day match today's date and whose lastBirthdayMessageSentYear differs from the current year
- [ ] The broadcast builder accurately previews the count of customers matching the current filter, and the send result toast reports correct sent and failed counts
- [ ] Promotion auto-apply updates the CartPanel in real time as cart contents change
- [ ] CashMovements appear in the Z-Report petty cash section and are factored into the cash reconciliation expected-in-drawer total
- [ ] Seed script creates demo hardware config and 10 AuditLog entries idempotently on repeated runs

## Files Created or Modified

- src/lib/services/audit.service.ts (created)
- src/lib/hardware/printer.ts (created)
- src/lib/hardware/cashDrawer.ts (created)
- src/app/api/audit-logs/route.ts (created)
- src/app/api/hardware/test-print/route.ts (created)
- src/app/api/hardware/test-drawer/route.ts (created)
- src/app/api/cfd/stream/route.ts (created)
- src/app/api/cfd/update/route.ts (created)
- src/app/api/cron/birthday-messages/route.ts (created)
- src/app/api/broadcast/whatsapp/route.ts (created)
- src/app/api/customers/count/route.ts (created)
- src/app/api/promotions/evaluate/route.ts (created)
- src/app/api/shifts/[id]/cash-movements/route.ts (created)
- src/app/dashboard/[tenantSlug]/settings/audit-log/page.tsx (created)
- src/app/dashboard/[tenantSlug]/settings/hardware/page.tsx (created)
- src/app/dashboard/[tenantSlug]/cfd/page.tsx (created)
- src/app/dashboard/[tenantSlug]/customers/broadcast/page.tsx (created)
- src/lib/services/sale.service.ts (modified — audit log side effects)
- src/lib/services/return.service.ts (modified — audit log side effect + cash drawer trigger)
- src/lib/services/customer.service.ts (modified — audit log side effect on credit balance change)
- src/lib/services/staff.service.ts (modified — audit log on role/PIN/permission change)
- src/lib/services/promotion.service.ts (modified — audit log on create/update/archive)
- src/lib/services/stock.service.ts (modified — audit log on stock adjustment)
- src/lib/services/expense.service.ts (modified — audit log on create/delete)
- src/lib/services/shift.service.ts (modified — audit log on shift close)
- prisma/schema.prisma (modified — Customer.lastBirthdayMessageSentYear field added)
- prisma/seed.ts (modified — demo hardware config, AuditLog entries, CashMovement records)
