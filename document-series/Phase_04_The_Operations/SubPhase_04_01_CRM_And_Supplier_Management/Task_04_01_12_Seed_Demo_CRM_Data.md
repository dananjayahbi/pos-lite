# Task 04.01.12 — Seed Demo CRM Data

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.12 |
| Task Name | Seed Demo CRM Data |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Low |
| Estimated Effort | 1–2 hours |
| Prerequisites | 04.01.01 (models migrated), 04.01.08 (PO service for reference) |
| Output | Extended `prisma/seed.ts` with CRM demo data block |

---

## Objective

Extend the existing seed script with a complete CRM demo data block that creates representative customers, suppliers, purchase orders, and a broadcast record for the demo tenant. The seed is idempotent — re-running it must not produce duplicate records. The data is designed to showcase the full breadth of CRM and procurement features when demoing VelvetPOS.

---

## Context

The seed script at `prisma/seed.ts` already establishes the demo tenant, products, variants, shifts, and sale records from earlier phases. This task appends a new logical section to that script. All records are created for the demo tenant only. Phone numbers use the `+94` Sri Lanka country code prefix with clearly fictitious numbers to prevent accidental outbound messages. Idempotency is achieved by checking for the existence of each record (by phone for customers, by name for suppliers) before creating it.

---

## Instructions

### Step 1: Structure the CRM Seed Section

Open `prisma/seed.ts`. Locate the bottom of the file (after all previous seed sections). Add a comment block: "— CRM and Supplier Demo Data (SubPhase 04.01) —". Wrap all new seed logic for this phase in an `async` function called `seedCRMData(tenantId)` and call it from the main `main()` function at the end, passing the demo tenant's ID.

### Step 2: Seed 10 Demo Customers

Create the following 10 demo customers. For each, check existence by querying `prisma.customer.findFirst({ where: { tenantId, phone: customer.phone } })` before creating. If found, skip. Log creation or skip for each.

The 10 customers, designed to represent realistic Sri Lankan clothing store demographics:

| Name | Phone | Tags | Birthday | Credit Balance | Notes |
|---|---|---|---|---|---|
| Amara Perera | +94770000001 | VIP, Regular | 1990-03-17 | 1500.00 | Loyal since 2019 |
| Nimal Fernando | +94770000002 | Wholesale | — | 0.00 | Bulk buyer |
| Dilani Jayawardena | +94770000003 | VIP | 1985-06-21 | 0.00 | Prefers Colombo branch |
| Kasun Dissanayake | +94770000004 | Regular | 1995-11-08 | -500.00 | Outstanding balance |
| Priya Rajapaksa | +94770000005 | VIP, Online | 1992-07-14 | 2000.00 | Online orders |
| Chamara Silva | +94770000006 | Regular | — | 0.00 | Walk-in customer |
| Ruwan Bandara | +94770000007 | Wholesale | 1978-02-28 | 0.00 | Monthly orders |
| Sanduni Gunawardena | +94770000008 | VIP | 1998-09-03 | 750.00 | Gift voucher holder |
| Tharindu Wickramasinghe | +94770000009 | Regular | 1988-12-25 | 0.00 | Seasonal buyer |
| Ishani Mendis | +94770000010 | Staff | 1993-04-18 | 0.00 | Staff member discount |

Set `totalSpend` for VIP customers to realistic values: Amara 45000.00, Dilani 62000.00, Priya 38000.00, Sanduni 28000.00. Set `isActive: true` for all. Set `gender` where inferrable from names (treat as optional in seed — use your knowledge of Sri Lankan names to infer where reasonable, or leave as null for Phase 04 seed simplicity). Parse `birthday` strings as JavaScript `new Date("YYYY-MM-DD")`.

### Step 3: Seed 3 Demo Suppliers

Create 3 suppliers. Check existence by `prisma.supplier.findFirst({ where: { tenantId, name: supplier.name } })`.

| Name | Contact | Phone | WhatsApp | Lead Time |
|---|---|---|---|---|
| Colombo Fashion Imports | Ruwan Senanayake | +94112000001 | +94770100001 | 14 |
| Lanka Textile Mills | Nirosha Wickrama | +94112000002 | +94770100002 | 7 |
| FabricCo Wholesale | Saman Rathnayake | +94112000003 | +94770100003 | 10 |

Set `email` for each as `contact@[lowercased-name-with-dashes].lk` (fictitious). Set `isActive: true`. Log each creation.

### Step 4: Retrieve Existing Variant IDs

After seeding suppliers, fetch two existing `ProductVariant` records from the demo tenant's products. These are needed for PO line items. Fetch them with `prisma.productVariant.findMany({ where: { product: { tenantId } }, take: 2 })`. If fewer than two variants exist (unlikely given earlier seed phases), log a warning and skip PO creation. Store the two variants as `variantA` and `variantB`.

### Step 5: Seed a RECEIVED Purchase Order

Check existence by `prisma.purchaseOrder.findFirst({ where: { tenantId, notes: 'Demo PO — Received (seed)' } })`. If found, skip.

Create a PO for the "Lanka Textile Mills" supplier with `status: POStatus.RECEIVED`, `expectedDeliveryDate: new Date()` (today), and `notes: 'Demo PO — Received (seed)'`. Use `prisma.purchaseOrder.create` with nested `createMany` for two lines:

- Line 1: `variantId: variantA.id`, `productNameSnapshot` and `variantDescriptionSnapshot` pulled from the variant data fetched in Step 4, `orderedQty: 20`, `expectedCostPrice: 850.00`, `receivedQty: 20`, `actualCostPrice: 840.00`, `isFullyReceived: true`.
- Line 2: `variantId: variantB.id`, `orderedQty: 15`, `expectedCostPrice: 1200.00`, `receivedQty: 15`, `actualCostPrice: 1200.00`, `isFullyReceived: true`.

Set `totalAmount: (20 × 850) + (15 × 1200) = 35000`. Do not call `adjustStock` from the service — directly update each variant's `stockQuantity` to reflect that goods were received, using `prisma.productVariant.update` with `stockQuantity: { increment: orderedQty }`. Add a code comment explaining this direct increment is intentional for seed data and should not be imitated in production code.

### Step 6: Seed a DRAFT Purchase Order

Check existence by `prisma.purchaseOrder.findFirst({ where: { tenantId, notes: 'Demo PO — Draft (seed)' } })`. If found, skip.

Create a PO for the "Colombo Fashion Imports" supplier with `status: POStatus.DRAFT`, `expectedDeliveryDate` set 21 days in the future from `new Date()`, and `notes: 'Demo PO — Draft (seed)'`. Two lines:

- Line 1: `variantId: variantA.id`, `orderedQty: 30`, `expectedCostPrice: 900.00`, `receivedQty: 0`, `isFullyReceived: false`.
- Line 2: `variantId: variantB.id`, `orderedQty: 10`, `expectedCostPrice: 1350.00`, `receivedQty: 0`, `isFullyReceived: false`.

Set `totalAmount: (30 × 900) + (10 × 1350) = 40500`.

### Step 7: Seed a CustomerBroadcast Record

Check existence by `prisma.customerBroadcast.findFirst({ where: { tenantId, message: { contains: 'End of Season Sale' } } })`.

Using the first admin user's ID from the tenant (fetched with `prisma.user.findFirst({ where: { tenantId } })`), create a `CustomerBroadcast` record: `message: "Dear Valued Customer, our End of Season Sale is here! Visit us this weekend for up to 40% off selected items. Thank you for shopping with us!"`, `sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)` (7 days ago), `recipientCount: 8`, `sentById: user.id`, `filters: { tag: 'VIP' }`.

### Step 8: Log Summary

At the end of `seedCRMData`, log a summary to console:

- "CRM Seed: [N] customers created (or skipped if already exist)"
- "CRM Seed: 3 suppliers seeded"
- "CRM Seed: 2 purchase orders seeded (1 RECEIVED, 1 DRAFT)"
- "CRM Seed: 1 CustomerBroadcast record seeded"

---

## Expected Output

- `prisma/seed.ts` — extended with `seedCRMData(tenantId)` block at the bottom.
- Running `pnpm prisma db seed` creates all records on a fresh database and skips them on subsequent runs.

---

## Validation

- [ ] Running `pnpm prisma db seed` on a clean database creates all 10 customers, 3 suppliers, 2 POs, and 1 broadcast record without errors.
- [ ] Re-running `pnpm prisma db seed` produces no duplicate records and the console shows "skipped" messages for all records that already exist.
- [ ] Prisma Studio shows the RECEIVED PO with both lines having `isFullyReceived: true` and `receivedQty` matching `orderedQty`.
- [ ] The DRAFT PO has `receivedQty: 0` on both lines.
- [ ] Customer Amara Perera has `creditBalance: 1500.00` and `totalSpend: 45000.00`.
- [ ] Customer Kasun Dissanayake has `creditBalance: -500.00` (negative, representing a debt).
- [ ] The CustomerBroadcast record has `filters: { tag: 'VIP' }` stored as JSON.

---

## Notes

- All phone numbers use `+94` prefix and the 77000000X range — these are non-existent numbers chosen to avoid accidental real-world deliveries if the WhatsApp integration is live during seed runs in a staging environment.
- The direct `stockQuantity: { increment: orderedQty }` approach for seed data bypasses the `adjustStock` audit trail. This is intentional — the seed script is synthetic data, not a real goods-receiving event. In production, every stock change must go through `adjustStock` to maintain an accurate `StockMovement` history.
- Treat the `createdById` on the seed POs as the first available user for the demo tenant. If no user exists yet when `seedCRMData` runs, add a guard that logs a warning and skips PO creation rather than throwing an unhandled error.
- The `birthday` dates in the customer seed list are intentionally spread across different months and days to make it easy to test the birthday cron endpoint by temporarily setting `today` in the cron logic to a specific date that matches one of the seeded birthdays.
