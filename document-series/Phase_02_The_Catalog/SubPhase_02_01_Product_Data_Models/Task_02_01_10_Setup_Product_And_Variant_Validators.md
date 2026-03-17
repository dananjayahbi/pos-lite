# Task 02.01.10 — Setup Product And Variant Validators

## Metadata

| Property             | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Sub-Phase            | 02.01 — Product & Variant Data Models                              |
| Phase                | 02 — The Catalog                                                   |
| Estimated Complexity | Medium                                                             |
| Dependencies         | Task_02_01_09 (Route Handlers inform validator requirements — can be developed in parallel with careful coordination) |

---

## Objective

Create Zod validation schemas for all catalog-related request bodies and query parameters, providing precise, user-friendly validation error messages and appropriate cross-field validation rules.

---

## Instructions

### Step 1: Create the Product Validators File

Create the file src/lib/validators/product.validators.ts. This file contains schemas for the Product and related query parameters. Import Zod from the zod package. Import the GenderType and TaxRule enum values from the Prisma Client to use as the allowed enum values in the Zod schema — this ensures that if new enum values are added to the Prisma schema, the Zod validators will need to be explicitly updated (a deliberate safety mechanism rather than automatically inheriting new values without review).

### Step 2: Define CreateProductSchema

The CreateProductSchema validates the body of POST /api/products requests. Define it with the following fields:

- name: a string with a minimum length of 2 characters and a maximum of 120 characters. The minimum prevents single-character product names that would be functionally useless. The error message for the minimum should read "Product name must be at least 2 characters".
- description: an optional string with a maximum of 1000 characters.
- categoryId: a string validated as a UUID using Zod's .uuid() method. The error message should read "A valid category ID is required".
- brandId: an optional string. When present, it must be a valid UUID. Use Zod's optional combined with a UUID validation, but allow an empty string to be treated as undefined (to accommodate HTML form submissions where empty selects submit empty strings). Apply a .transform() to convert an empty string to undefined.
- gender: Zod's nativeEnum() using the GenderType Prisma enum.
- tags: an optional array of strings. Each tag string must be a maximum of 30 characters. Defaults to an empty array if not provided.
- taxRule: Zod's nativeEnum() using the TaxRule Prisma enum, defaulting to STANDARD_VAT.

### Step 3: Define CreateVariantInputSchema

The CreateVariantInputSchema validates each entry in the variantDefinitions array of the product create body, and also serves as the schema for the POST endpoint if variants are created independently. Fields:

- size: optional string, maximum 10 characters.
- colour: optional string, maximum 50 characters.
- costPrice: a positive number (using .positive()). The error message should read "Cost price must be a positive number".
- retailPrice: a positive number.
- wholesalePrice: optional positive number.
- lowStockThreshold: a non-negative integer (using .int().min(0)), defaulting to 5.
- barcode: optional string with a minimum of 8 and maximum of 20 characters. When provided, must match a pattern of alphanumeric characters and hyphens only. The error message should read "Barcode must be 8-20 alphanumeric characters".
- sku: optional string with a maximum of 50 characters.

Apply cross-field validation using Zod's .refine() on the schema object: assert that retailPrice is greater than or equal to costPrice, with the error message "Retail price must be greater than or equal to cost price" attached to the retailPrice path. Apply a second refinement: if wholesalePrice is provided, assert that it is between costPrice and retailPrice inclusive, with appropriate error messages on the wholesalePrice path.

### Step 4: Define UpdateProductSchema and UpdateVariantSchema

The UpdateProductSchema is a partial version of CreateProductSchema using Zod's .partial() method, with one addition: an isArchived boolean optional field. All fields become optional in an update.

The UpdateVariantSchema allows partial updates to a variant. Include: costPrice (optional positive number), retailPrice (optional positive number), wholesalePrice (optional positive number, nullable), lowStockThreshold (optional non-negative int), barcode (optional string matching the barcode format, nullable), imageUrls (optional array of strings, each validated as a URL using .url()), sku (optional string maximum 50 characters). Apply the same retailPrice >= costPrice refinement using .superRefine() to handle the case where only one price field is provided — if both are present in the update, enforce the ordering; if only one is present, skip the cross-field check.

### Step 5: Create the Variant Validators File

Create the file src/lib/validators/variant.validators.ts and re-export CreateVariantInputSchema and UpdateVariantSchema from it, keeping the file focused and letting the product validators file remain the canonical source of these schemas for now.

### Step 6: Create the Category Validators File

Create the file src/lib/validators/category.validators.ts. Define:

CategorySchema: name (string, min 2, max 60 characters), description (optional string, max 500), parentId (optional UUID string, nullable — allows setting or clearing a parent), sortOrder (optional non-negative integer, default 0).

UpdateCategorySchema: .partial() of CategorySchema.

### Step 7: Define Brand and Query Parameter Schemas

Within the product validators file (or in a co-located brands validators file if preferred for organisation), define:

BrandSchema: name (string, min 2, max 60), description (optional string, max 500), logoUrl (optional string validated as a URL using .url() — error message "Logo URL must be a valid URL").

ProductListQuerySchema: validate query parameters for GET /api/products. All fields are optional strings from the URL query string. Use Zod's coerce for numeric fields. Include: search (optional string, max 100 characters), categoryId (optional UUID), brandId (optional UUID), gender (optional nativeEnum GenderType), isArchived (optional boolean coerced from the string "true" or "false" using z.enum(["true","false"]).transform()), page (optional, coerced to positive integer, default 1), limit (optional, coerced to positive integer between 1 and 100, default 20).

StockAdjustmentSchema (for manual stock adjustment API in Phase 02.03, but define now): variantId (UUID), quantityDelta (integer — may be negative), reason (nativeEnum StockMovementReason), note (optional string, max 500).

### Step 8: Export All Schemas

Ensure each validator file has clearly named exports for all schemas and any TypeScript types inferred from them using z.infer<typeof Schema>. For example, export type CreateProductInput = z.infer<typeof CreateProductSchema>. These inferred types are used in the service layer function signatures to ensure exact alignment between what the validator accepts and what the service expects.

---

## Expected Output

- src/lib/validators/product.validators.ts with CreateProductSchema, UpdateProductSchema, ProductListQuerySchema, BrandSchema, StockAdjustmentSchema
- src/lib/validators/variant.validators.ts with CreateVariantInputSchema, UpdateVariantSchema
- src/lib/validators/category.validators.ts with CategorySchema, UpdateCategorySchema
- Cross-field refinements on variant pricing rules
- Inferred TypeScript types exported alongside each schema

---

## Validation

- [ ] CreateProductSchema rejects a name shorter than 2 characters with the correct error message
- [ ] CreateVariantInputSchema rejects retailPrice less than costPrice with the error on the retailPrice field path
- [ ] CreateVariantInputSchema rejects a barcode not matching the alphanumeric format
- [ ] ProductListQuerySchema coerces page and limit from strings to integers and clamps limit between 1 and 100
- [ ] UpdateVariantSchema allows partial updates without triggering the retailPrice/costPrice refinement when only one price is provided
- [ ] All inferred TypeScript types are exported and valid
- [ ] pnpm tsc --noEmit passes with no errors in any of the three validator files

---

## Notes

Cross-field Zod validation using .refine() applies at the object level after individual field validation passes. This means if costPrice itself fails validation (for example, it is not a positive number), the refine that checks retailPrice >= costPrice will not run. This is the correct behaviour — field-level errors are reported first, and once those are fixed, cross-field errors are reported.

The coercion of query parameter strings to appropriate types in ProductListQuerySchema is important because URL query parameters are always strings. Using z.coerce.number() will convert "20" to 20, but it will also accept "20abc" and convert it to NaN, which is not desirable. Pair coerce with additional validations (.int().positive()) to catch these edge cases and return a clear 400 error before the service is called.

The StockAdjustmentSchema defined here will be used in Phase 02.03 when the manual stock adjustment UI is built. Defining it now ensures the validator is available when the route is created, and keeps all inventory-related validators centralised.
