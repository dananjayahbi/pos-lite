# SubPhase 04.01 — CRM and Supplier Management

## Metadata

| Field | Value |
|---|---|
| SubPhase ID | 04.01 |
| SubPhase Name | CRM and Supplier Management |
| Phase | 04 — The Operations |
| Status | Planned |
| Complexity | High |
| Estimated Tasks | 12 |
| Prerequisites | SubPhase 03.01 (POS Core), SubPhase 03.02 (Payments and Receipts), SubPhase 03.03 (Returns and Exchanges) |
| Owner | Backend + Frontend |

---

## Objective

Establish the relational backbone connecting VelvetPOS to its customers and suppliers. This SubPhase introduces full CRM capabilities — customer profiles, purchase history, store credit redemption at the POS terminal, birthday automation via WhatsApp, a marketing broadcast builder, and bulk CSV import. It also delivers the complete supplier and procurement cycle: Supplier profiles, Purchase Orders with a defined status machine, a Goods Receiving workflow that integrates with the existing `adjustStock` service, and WhatsApp dispatch of purchase orders directly to supplier contacts.

---

## Scope

### In Scope

- Customer model including `creditBalance`, `totalSpend`, `tags`, `gender`, `birthday`, and soft delete.
- Supplier model with contact info, lead time, and WhatsApp number.
- PurchaseOrder and PurchaseOrderLine models with the `POStatus` enum.
- CustomerBroadcast model storing broadcast history with a filters snapshot.
- BirthdayGreetingLog model for audit trail of automated greetings.
- Customer management pages — paginated list, detail view with history tabs, create/edit Sheet.
- Customer linking at the POS terminal — associating a customer to a cart at checkout.
- Store credit redemption at POS — toggle to apply positive `creditBalance` against the net payable amount.
- `Customer.totalSpend` incremented on every completed sale linked to a customer.
- Birthday automation cron endpoint sending WhatsApp greetings via Meta Cloud API.
- Marketing broadcast builder page with recipient filter and synchronous send.
- Customer CSV import with row-level validation and duplicate detection.
- Supplier management pages — list and create/edit Sheet.
- Purchase Order pages — list, detail, new PO creation form.
- Goods Receiving Modal — line-by-line receiving, `adjustStock` integration, cost price update prompt.
- PO WhatsApp dispatch — format and send a PO text message to the supplier contact.
- Demo seed data — 10 customers, 3 suppliers, 2 POs, and 1 broadcast record.

### Out of Scope

- Email marketing (all direct communication is WhatsApp-only in this phase).
- Accounts payable ledger and supplier invoice matching.
- Multi-location inventory distribution from a single purchase order.
- Mobile app or PWA customer-facing experience.
- Loyalty points or tier systems (the signed `creditBalance` is the sole loyalty mechanism).
- Asynchronous batch queuing for large broadcasts (synchronous execution, capped at 200 recipients per call, is sufficient for Phase 04).

---

## Technical Context

### Customer Credit Balance Design

`Customer.creditBalance` is a signed `Decimal` field. A **positive** value means the store owes the customer money — typically returned store credit issued during a refund (SubPhase 03.03). A **negative** value means the customer owes the store money, representing an outstanding debt. At the POS terminal, only positive balances are presented as an eligible payment offset. The `redeemCredit` service function decrements the balance and must be called **inside** the active sale `$transaction` block to ensure atomicity with stock adjustment and payment recording. The `applyCreditToCart` function (called before the transaction begins, from the cart UI) performs a pre-flight validation to confirm the requested amount does not exceed the current balance.

### PO Status Machine

A Purchase Order transitions through the following states in order:

- `DRAFT` — newly created, fully editable, can be sent or cancelled.
- `SENT` — WhatsApp dispatch has been confirmed; the PO is locked for editing; goods receiving is now available.
- `PARTIALLY_RECEIVED` — at least one line has received stock but at least one line remains outstanding.
- `RECEIVED` — every PO line has `isFullyReceived = true`; the PO is immutable.
- `CANCELLED` — only reachable from `DRAFT` or `SENT`; a cancelled PO cannot be re-opened or modified.

The status is computed by `receivePOLines` after each receiving session and written to the database explicitly — it is not a derived field — so that list-page filters can leverage the `(tenantId, status)` composite index efficiently.

### Cost Price Update on Receiving

When the staff member enters an `actualCostPrice` on a PO line during goods receiving that differs from the variant's current `ProductVariant.costPrice`, the service updates the cost price inside the same database transaction. After the API responds, the frontend reads a `costPricesChanged` flag on the response payload. If that flag is true, a follow-up `AlertDialog` is rendered listing the affected variants and offering an "Update Cost Prices" confirmation. This extra step exists purely for UX transparency — the database update has already occurred by the time the dialog appears.

### WhatsApp Integration

Both birthday greetings and PO dispatch use the Meta Cloud API text message endpoint encapsulated in `src/lib/whatsapp.ts`, established in SubPhase 03.02. The birthday cron endpoint is secured by a `CRON_SECRET` environment variable validated against the `Authorization: Bearer` header on every incoming request. Broadcast sends are executed synchronously in the API route handler and are hard-capped at 200 recipients to stay within acceptable response time bounds for this phase.

---

## Task List

| Task ID | Task Name | Complexity | Dependencies |
|---|---|---|---|
| 04.01.01 | Create Customer and Supplier Models | Medium | Phase 03 schema completed |
| 04.01.02 | Build Customer Service Layer | High | 04.01.01 |
| 04.01.03 | Build Customer Management Pages | High | 04.01.02 |
| 04.01.04 | Build POS Customer Linking and Store Credit | High | 04.01.02, SubPhase 03.01 cart state |
| 04.01.05 | Build Birthday and Broadcast WhatsApp | High | 04.01.01, whatsapp.ts |
| 04.01.06 | Build Customer CSV Import | Medium | 04.01.01 |
| 04.01.07 | Build Supplier Management Pages | Medium | 04.01.01 |
| 04.01.08 | Build Purchase Order Service | High | 04.01.01, adjustStock service |
| 04.01.09 | Build Purchase Order Pages | High | 04.01.08 |
| 04.01.10 | Build Goods Receiving Modal | Medium | 04.01.08, 04.01.09 |
| 04.01.11 | Build PO WhatsApp Dispatch | Medium | 04.01.08, whatsapp.ts |
| 04.01.12 | Seed Demo CRM Data | Low | 04.01.01, 04.01.08 |

---

## Validation Criteria

- [ ] Running the Prisma migration applies without errors and all six new tables — Customer, Supplier, PurchaseOrder, PurchaseOrderLine, CustomerBroadcast, BirthdayGreetingLog — are visible in Prisma Studio.
- [ ] A customer can be created, edited, and soft-deleted from the dashboard. The list page respects pagination and filtering by tag and spend band.
- [ ] Linking a customer at the POS terminal persists `customerId` on the completed sale record in the database.
- [ ] A customer with a positive `creditBalance` sees the "Use Store Credit" toggle at checkout; toggling it correctly reduces the displayed Amount Due.
- [ ] After a sale where store credit is applied, `Customer.creditBalance` is decremented by exactly the applied amount and the change is transactionally consistent with the sale record.
- [ ] After every completed sale linked to a customer, `Customer.totalSpend` is incremented by the sale total.
- [ ] The birthday cron endpoint returns HTTP 200, sends the greeting to every qualifying customer, and logs each attempt to `BirthdayGreetingLog`.
- [ ] The broadcast builder correctly previews recipient count before sending and returns HTTP 422 when the recipient count exceeds 200.
- [ ] The CSV import endpoint processes a 100-row file, correctly skips rows with duplicate phone numbers, and returns the imported/skipped/errors breakdown.
- [ ] A Purchase Order can be created in DRAFT, dispatched via WhatsApp advancing it to SENT, and then received advancing it to PARTIALLY_RECEIVED or RECEIVED with `adjustStock` updating variant quantities correctly.
- [ ] The Goods Receiving Modal displays correct remaining quantities per line, prevents over-receiving, and shows the cost price update dialog when `actualCostPrice` differs.
- [ ] The demo seed script runs idempotently — re-running it does not duplicate records — and produces the expected counts.

---

## Files Created or Modified

- `prisma/schema.prisma` — Customer, Supplier, PurchaseOrder, PurchaseOrderLine, CustomerBroadcast, BirthdayGreetingLog models; `POStatus` enum; `Sale.customerId` nullable FK.
- `prisma/migrations/[timestamp]_add_crm_and_supplier_models/migration.sql` — generated migration.
- `prisma/seed.ts` — extended with CRM demo data block.
- `src/lib/services/customer.service.ts` — new file.
- `src/lib/services/supplier.service.ts` — new file.
- `src/lib/services/purchaseOrder.service.ts` — new file.
- `src/app/api/customers/route.ts` — customer list and create.
- `src/app/api/customers/[id]/route.ts` — customer get, update, soft delete.
- `src/app/api/customers/import/route.ts` — CSV import endpoint.
- `src/app/api/customers/broadcast/route.ts` — broadcast send endpoint.
- `src/app/api/cron/birthday-greetings/route.ts` — birthday cron endpoint.
- `src/app/api/suppliers/route.ts` — supplier list and create.
- `src/app/api/suppliers/[id]/route.ts` — supplier update.
- `src/app/api/suppliers/[id]/archive/route.ts` — supplier soft archive.
- `src/app/api/purchase-orders/route.ts` — PO list and create.
- `src/app/api/purchase-orders/[id]/route.ts` — PO get and update.
- `src/app/api/purchase-orders/[id]/receive/route.ts` — goods receiving.
- `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts` — PO WhatsApp dispatch.
- `src/app/dashboard/[tenantSlug]/customers/page.tsx` — customer list page.
- `src/app/dashboard/[tenantSlug]/customers/[customerId]/page.tsx` — customer detail page.
- `src/app/dashboard/[tenantSlug]/customers/broadcast/page.tsx` — broadcast builder page.
- `src/app/dashboard/[tenantSlug]/suppliers/page.tsx` — supplier list page.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/page.tsx` — PO list page.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/new/page.tsx` — new PO form page.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx` — PO detail page.
- `src/components/pos/CartPanel.tsx` — modified to add customer linking and store credit toggle.
- `src/components/suppliers/GoodsReceivingModal.tsx` — new component.
- `src/components/customers/CustomerSearchDropdown.tsx` — new component.
- `src/components/customers/BroadcastForm.tsx` — new component.
- `src/components/customers/ImportCustomersSheet.tsx` — new component.
