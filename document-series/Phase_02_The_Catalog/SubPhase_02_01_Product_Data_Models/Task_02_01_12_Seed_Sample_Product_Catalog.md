# Task 02.01.12 — Seed Sample Product Catalog

## Metadata

| Property             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Sub-Phase            | 02.01 — Product & Variant Data Models                        |
| Phase                | 02 — The Catalog                                             |
| Estimated Complexity | Medium                                                       |
| Dependencies         | Task_02_01_06 (Product service layer), Task_02_01_03 (ProductVariant model) |

---

## Objective

Extend prisma/seed.ts to create a realistic sample clothing catalog for the development tenant, including categories, brands, products, and variants with stock levels. The seeder must be idempotent and produce enough varied data to meaningfully test UI, filters, and low-stock alerts.

---

## Instructions

### Step 1: Understand the Idempotency Requirement

A seed script that creates the same data every time it is run without checking for existing data will accumulate duplicate records and eventually break the development environment. The catalog seeder must be idempotent: it should check whether catalog seed data already exists before creating anything. The simplest idempotency check is to query for the existence of the first seed category (for example, "Men's Shirts") scoped to the development tenant. If that category already exists, the seeder should log a message indicating that catalog data is already seeded and return early without creating any new records.

Locate the development tenant's ID in the prisma/seed.ts file — it was created by the Phase 01.03.12 seeder. If that seeder stored the tenant ID as a constant in the file, reference it directly. If the tenant is created by email or name, fetch it using a prisma.tenant.findFirst() call filtered on the tenant's identifying field.

### Step 2: Define the Seed Data Arrays

Before writing the database creation logic, define the raw seed data as plain JavaScript arrays of objects. This makes the seeder easy to extend and the data easy to read.

Define a categories array with five objects: Men's Shirts (UNISEX gender suggestion, sortOrder 1), Women's Dresses (sortOrder 2), Unisex Accessories (sortOrder 3), Kids Clothing (sortOrder 4), Sportswear (sortOrder 5). Each object has name and sortOrder fields.

Define a brands array with four objects: NovaWear (a contemporary Sri Lankan fashion brand), UrbanThread (urban streetwear), SilkTropic (premium tropical occasion wear), ActivePeak (sportswear and performance apparel). Each object has name and description fields.

Define size sets as a mapping from category name to an array of size strings. Men's Shirts uses [S, M, L, XL, XXL]. Women's Dresses uses [XS, S, M, L]. Kids Clothing uses [4Y, 6Y, 8Y, 10Y, 12Y]. Sportswear uses [S, M, L, XL]. Unisex Accessories uses [ONE SIZE].

Define colour sets as a mapping from category name to an array of colour name strings. Men's Shirts uses [White, Sky Blue, Charcoal, Slate Grey, Navy]. Women's Dresses uses [Blush Rose, Ivory, Forest Green, Midnight Blue, Terracotta]. Kids Clothing uses [Coral, Yellow, Mint, Lavender]. Sportswear uses [Black, Cobalt Blue, Flame Orange, Slate]. Unisex Accessories uses [Tan, Black, Olive, Camel, Steel].

### Step 3: Define the 30 Products

Create a products array containing exactly 30 product objects. Each object has: name, description, genderType, taxRule, brandName (used to look up the brand), categoryName (used to look up the category), and tags. Distribute products roughly as follows: 8 products in Men's Shirts, 8 in Women's Dresses, 5 in Unisex Accessories, 5 in Kids Clothing, and 4 in Sportswear. Assign brands plausibly: NovaWear and UrbanThread for most Men's Shirts and Sportswear; SilkTropic for Women's Dresses; any brand for accessories and kids. Include both STANDARD_VAT and SSCL tax rules across the products. Example product names: "Classic Oxford Button-Down", "Slim Fit Linen Shirt", "Floral Wrap Dress", "Silk Evening Gown", "Leather Tote Bag", "Athletic Performance Tee", "Kids Graphic Print Tee", and so on — names realistic for a Sri Lankan clothing boutique.

### Step 4: Implement the Category and Brand Creation Logic

After the idempotency check, use prisma.category.createMany to insert all five categories in a single operation with tenantId set to the development tenant ID. Use prisma.brand.createMany for the four brands. After creation, fetch all created categories and brands using prisma.category.findMany and prisma.brand.findMany filtering by tenantId to get their generated IDs. Build lookup maps (plain JavaScript objects) keyed by name for both categories and brands so that the product creation loop can resolve the correct IDs by name.

### Step 5: Implement the Product and Variant Creation Loop

Iterate over the 30-product array. For each product, call createProduct from the product service with the development tenant ID and a system seeder actor ID (either a fixed seeder user ID or the super admin's ID from Phase 01.02.12). Alternatively, call prisma.product.create directly within the seeder for efficiency, since the seeder does not need to create AuditLog entries.

After creating each product, determine the size set and colour set for its category. Generate variants by forming every combination of size and colour from the respective sets. Limit each product to a maximum of 12 variants — if the full Cartesian product would produce more than 12, take only the first 12 size-colour pairs in iteration order.

For each variant, generate the following values:

- costPrice: a random value between 250 and 3000 (in Sri Lankan Rupees), rounded to two decimal places. Use a seeded random function or a deterministic formula based on product index and variant index to ensure the same values are produced on every seed run.
- retailPrice: costPrice multiplied by a multiplier randomly chosen between 2.0 and 2.8, rounded to two decimal places.
- stockQuantity: a random integer between 0 and 50. Intentionally set approximately 15% of variants to a value between 0 and 4 (below the lowStockThreshold of 5) to ensure the low stock alert functionality has realistic test data.
- lowStockThreshold: 5 for all seeded variants.
- sku: generated using the [BRAND-CODE]-[COLOUR-ABBREV]-[SIZE] format. Call the same SKU generation logic used in the service layer, or replicate the simple string manipulation inline if the service helper is not exported.

Use prisma.productVariant.createMany to insert all variants for a product in one database call.

### Step 6: Log Seoding Progress and Summary

After all creation is complete, log a summary to the console:  the number of categories created, brands created, products created, total variants created, and the number of variants that were set below their lowStockThreshold. This summary is visible when running pnpm prisma db seed and helps confirm the seeder worked correctly without requiring manual database inspection.

### Step 7: Verify the Seeded Data Through the API

After running the seeder with pnpm prisma db seed, open a terminal and test GET /api/products (with the development server running via pnpm dev). Confirm that the response contains at least 30 products in the data array. Then test GET /api/products?categoryId=<men-shirts-id> and confirm it returns only the products in that category. Finally, test the low stock endpoint if it is available at this stage, and confirm that some variants appear in the low-stock list.

---

## Expected Output

- prisma/seed.ts extended with a catalog seeder section
- 5 categories, 4 brands, 30 products, and 150–300+ variants created for the development tenant
- Approximately 15% of variants set below lowStockThreshold of 5
- costPrice and retailPrice are realistic values in Sri Lankan Rupees (Rs. 500–8400 range)
- Seeder is idempotent and skips cleanly if catalog data already exists
- A seeding summary is logged to the console on completion

---

## Validation

- [ ] Running pnpm prisma db seed twice does not create duplicate categories or products
- [ ] GET /api/products returns 30 or more products for the development tenant
- [ ] GET /api/products?gender=WOMEN returns only products with gender WOMEN or UNISEX
- [ ] At least 4 variants have stockQuantity below their lowStockThreshold of 5
- [ ] Each variant has a non-null SKU matching the expected format
- [ ] retailPrice is always greater than or equal to costPrice for all seeded variants
- [ ] Console log shows a summary after seeding completes

---

## Notes

Deterministic pricing in the seeder avoids a situation where developers have different costPrice and retailPrice values in their local databases, which would cause confusing discrepancies when discussing stock valuation numbers in team meetings. Use a simple formula such as basePrice = 250 + (productIndex * 88) + (variantIndex * 17) to produce consistent prices across seed runs without a seeded random number library.

The 15% low-stock variant target means that with approximately 240 total variants (30 products × average 8 variants), about 36 variants should be below their threshold. These should be distributed across multiple products and categories — not all concentrated in one category — to give the low-stock alert UI meaningful data to display.

The seeder should not create StockMovement records for the INITIAL_STOCK quantities. While it might seem logically correct to record a INITIAL_STOCK movement for each seeded variant, the seeder is setting up a test environment rather than simulating a real business start-of-day, and creating hundreds of movement records would clutter the movement history display during development. Real INITIAL_STOCK movements will be generated when the store onboarding flow is implemented.
