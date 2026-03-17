# Task 05.03.11 — Build Comprehensive Demo Seeder

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.11 |
| Task Name | Build Comprehensive Demo Seeder |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | High |
| Estimated Duration | 4–6 hours |
| Assignee Role | Lead Developer |
| Dependencies | All Prisma models finalized (including WebhookEndpoint from Task 05.03.02), Prisma migrate deploy run, seed script infrastructure exists |
| Output Files | prisma/seed.ts (substantially extended) |

## Objective

Extend prisma/seed.ts to generate a rich 90-day dataset of realistic VelvetPOS demo data, sized to populate all Phase 05 reports, commission charts, and analytics dashboards with meaningful, visually convincing output. The dataset is tailored to a Sri Lankan clothing boutique context: product names, price ranges expressed in LKR (Sri Lankan Rupees), and customer name patterns consistent with Sri Lankan demographics. The seeder runs idempotently — it skips all seed operations if the target demo tenant already has more than 100 sale records, preventing accidental data duplication on repeated runs.

## Context

A high-quality demo seeder is a critical business asset for VelvetPOS. It enables the product team to demonstrate the full platform to prospective tenants with realistic-looking analytics, not empty charts. The 90-day window is chosen to populate monthly trend charts (3 months of data), the rolling 30/60/90-day reportcomparisons, commission records covering multiple pay periods, and realistic time-clock data for staff attendance reports. The seeder must complete within 60 seconds on a standard development machine — this requires batching Prisma creates using createMany where possible rather than looping individual create calls.

## Instructions

**Step 1: Implement the Idempotency Guard**

At the very beginning of the seed function's demo data block, query the database for the count of Sale records belonging to the demo tenant slug. Use prisma.sale.count({ where: { tenantId: demoTenantId } }). If the count exceeds 100, log the message "Demo data already seeded — skipping. Delete demo sales to re-seed." and return early. This prevents the seeder from adding duplicate data when run multiple times. The guard threshold is 100 rather than 0 to allow a partially seeded database (from a failed prior run) to be completed by re-running the seed.

**Step 2: Create the Demo Tenant**

Use prisma.tenant.upsert with a where clause on the unique slug field set to "velvet-demo". The create block sets the tenant's name to "Velvet Boutique (Demo)", slug to "velvet-demo", planTier to PROFESSIONAL, subscriptionStatus to ACTIVE, and any other required fields. The update block is intentionally empty — if the tenant already exists, its plan and status are not overwritten. Store the resulting tenant's id in a demoTenantId constant for use in all subsequent seed steps.

**Step 3: Create Staff Users**

Create five staff members belonging to the demo tenant using prisma.user.createMany with skipDuplicates set to true (unique key on email). The five users are:

Kavindi Perera — email owner@velvetdemo.com, role OWNER, PIN hash for the PIN "1111" (use bcrypt with 10 salt rounds). Chamara Bandara — email manager@velvetdemo.com, role MANAGER, PIN "2222". Dilani Senanayake — email cashier1@velvetdemo.com, role CASHIER, PIN "3333". Ruwani Fernando — email cashier2@velvetdemo.com, role CASHIER, PIN "4444". Asela Wickramasinghe — email stock@velvetdemo.com, role STOCK_CLERK, PIN "5555". Store the created user IDs in an array for use in sale, commission, and time-clock seeding.

**Step 4: Create Product Catalogue**

Create 30 products across 5 clothing categories using prisma.product.createMany. Categories and representative products:

Sarees (6 products): Silk Handloom Saree, Georgette Printed Saree, Linen Saree, Cotton Daily Saree, Bridal Silk Saree, Batik Saree. Price range: LKR 3,500–22,000.

Kurtis and Tops (8 products): Embroidered Kurti, Cotton Swing Top, Chiffon Blouse, Linen Casual Kurti, Printed Tunic, Silk Kurti, Sleeveless Blouse, Lace Top. Price range: LKR 1,800–6,500.

Trousers and Palazzo (5 products): Wide-Leg Palazzo, Slim Cotton Trouser, Printed Palazzo, Linen Trouser, Culottes. Price range: LKR 2,200–5,500.

Dresses (7 products): Maxi Floral Dress, Bodycon Evening Dress, A-Line Midi Dress, Cotton Sundress, Formal Shift Dress, Kaftan Dress, Wrap Dress. Price range: LKR 3,200–18,000.

Accessories (4 products): Beaded Necklace Set, Embroidered Clutch Bag, Silk Hairband, Embellished Belt. Price range: LKR 1,500–4,500.

For each product, create 2–4 variants with prisma.productVariant.createMany. Variant axes are Size (XS, S, M, L, XL) and Colour (Ivory, Dusty Rose, Forest Green, Midnight Blue, Terracotta, Charcoal). Assign a stockQuantity between 8 and 40 to each variant randomly. The variant SKU follows the format DEMO-[PRODUCT_INDEX]-[VARIANT_INDEX].

**Step 5: Create Demo Customers**

Create 10 customer records using prisma.customer.createMany with skipDuplicates on phone. Customer names and phones:

Amali Jayasuriya (0771234001), Priya Navaratnarajah (0772234002), Nimesha Dissanayake (0773234003), Sanduni Rathnayake (0774234004), Hiruni Wickramasinghe (0775234005), Thilini Perera (0776234006), Chamali Gunaratne (0777234007), Rasika Fernando (0778234008), Sumudu Karunaratne (0779234009), Dinusha Silva (0710234010). Assign each a birthdate spread across the year so the birthday cron job has material to process. Store the customer IDs in an array.

**Step 6: Generate 1,000+ Sales Across 90 Days**

This is the most computationally intensive seeding step. Iterate over the 90 days from today minus 90 days to yesterday (exclusive of today). For each day, compute a sales count based on realistic retail patterns: 8–15 sales on weekdays, 18–28 sales on Fridays and Saturdays (peak shopping days for Sri Lankan boutiques), and 5–10 sales on Sundays. This produces a realistic variation without requiring external data.

Use a date-seeded pseudo-random number generator (a simple Linear Congruential Generator initialised per day using the day index as seed) to ensure deterministic output — the same seeder run always produces the same data distribution. For each sale on a given day:

Select a random cashier from the two CASHIER users. Assign a customer to 40% of sales (linked customer), leaving 60% as anonymous (null customerId). Select between 1 and 4 line items, each using a random product variant from the catalogue. Set saleTime to a random hour between 09:00 and 19:00 on the sale date. Compute the total using decimal.js arithmetic.

Because creating 1,000+ individual sale records sequentially would be slow, batch the sale inserts using prisma.sale.createMany in batches of 100. Then batch-insert the corresponding SaleItem records separately using prisma.saleItem.createMany, also in batches of 100. This approach requires generating IDs manually (using cuid() from the @paralleldrive/cuid2 package or a UUID generation approach) before insertion so that the sale ID can be referenced in the SaleItem records without relying on Prisma's auto-generated IDs.

**Step 7: Generate Demo Returns**

After the sales are created, select approximately 8% of them (around 80 records) to become return transactions. Query the created sale IDs from the database (or track them in memory during the seeding loop). For each selected sale, create a Return record using prisma.return.create with a reason drawn randomly from the list: "Size issue", "Colour mismatch", "Customer changed mind", "Defective item". Set the return date to 1–5 days after the original sale date. Set the refundAmount to the full sale total for simplicity.

**Step 8: Generate Supplier Records and Purchase Orders**

Create 5 supplier records: Jayasinghe Textiles (Colombo), Kandy Silk House (Kandy), Lanka Threads Pvt Ltd (Negombo), Oriental Fabrics (Colombo), Batik Crafts Direct (Matara). For each supplier, create 2–3 PurchaseOrder records spread across the 90-day window with status alternating between RECEIVED and PENDING. Each PO has 3–6 line items referencing demo products.

**Step 9: Generate Expense Records**

Create 12–15 expense records across the 90-day window for realistic operational costs relevant to a Sri Lankan boutique: Packaging Materials (LKR 5,000–12,000), Display Mannequin Repair (LKR 3,500), Air Conditioning Service (LKR 8,000), Staff Uniform (LKR 15,000), WhatsApp Business Subscription (LKR 1,200), Electricity Bill (LKR 18,000–25,000 monthly), Shop Rent (LKR 85,000 monthly), Tailor Alteration Service (recurring weekly at LKR 2,000–6,000). Assign each expense to the demo tenant and mark them as APPROVED.

**Step 10: Generate Commission Records**

For each of the 3 months covered by the 90-day window, create a CommissionRecord for each of the two CASHIER users. Commission rate is 1.5% of total sales amount handled by the cashier during the month. Compute this by summing the sale totals for sales where cashierId matches the user and saleDate falls within the month. Create CommissionRecord entries via prisma.commissionRecord.createMany.

**Step 11: Generate Time-Clock Entries**

For all five staff members, create daily TimeClock entries for the 90-day window. Weekday shifts: OWNER and MANAGER clock in between 08:30–09:15 and out between 17:30–18:30. CASHIER users clock in between 09:00–09:30 and out between 17:00–18:00. STOCK_CLERK works Tuesday, Thursday, and Saturday only (part-time pattern). Omit 5–8 random days per staff member to simulate leave or absence. Use prisma.timeClock.createMany in batches.

**Step 12: Log Completion Statistics**

At the end of the seed function, log a summary table to the console: number of products created, variants created, customers created, sales created, returns created, suppliers created, purchase orders created, expenses created, commission records created, and time-clock entries created. Also log the total elapsed time in seconds using Date.now() subtracted from the start timestamp captured at the beginning of the seed. Expected runtime: 30–60 seconds on a standard development PostgreSQL connection.

## Expected Output

- prisma/seed.ts — Extended with all 12 seeding steps producing 1,000+ sales across 90 days and all supporting records
- The seeder runs successfully on a clean demo database in under 60 seconds
- Subsequent runs on an already-seeded database complete in under 2 seconds with the idempotency guard message

## Validation

- [ ] pnpm prisma db seed completes without errors on a clean demo database
- [ ] The idempotency guard prevents double-seeding: running pnpm prisma db seed twice produces identical record counts
- [ ] Revenue report for the trailing 90-day period shows data in all chart intervals (no empty weeks)
- [ ] Commission report shows non-zero commission values for both CASHIER users
- [ ] Staff time-clock report shows attendance for all five users with realistic hours distribution
- [ ] The demo tenant's customer count is exactly 10 and product count is exactly 30
- [ ] Seed completion log shows total runtime under 60 seconds
- [ ] Sales higher on Friday and Saturday than midweek — verifiable in the weekly breakdown report chart

## Notes

- Use prisma.createMany with skipDuplicates: true wherever unique constraint violations are possible on seed reruns. This makes partial seed reruns safe without requiring a full database drop.
- The batch size of 100 records per createMany call is conservative and safe for most PostgreSQL configurations. If seeding still times out on a cloud database with high latency, reduce batches to 50. If performance needs improving in the opposite direction, increase batches to 200.
- All LKR amounts should be stored using decimal.js Decimal values converted to string before insertion into Prisma Decimal fields, consistent with the pattern used throughout the application's service layer.
