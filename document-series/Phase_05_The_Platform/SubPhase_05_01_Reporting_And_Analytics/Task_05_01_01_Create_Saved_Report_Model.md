# Task 05.01.01 — Create Saved Report Model

## Metadata

| Field        | Value                                               |
|--------------|-----------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                     |
| Phase        | 05 — The Platform                                   |
| Complexity   | Simple                                              |
| Dependencies | Phase 01 Prisma setup, Tenant and User models exist |

---

## Objective

Add the `SavedReport` model to the Prisma schema so users can persist named report configurations (date ranges, filters, report type) for quick re-access, and expose GET and POST endpoints under `/api/reports/saved`.

---

## Context

As the reporting suite grows, users will want to bookmark frequently-used filter combinations — for example, "Monthly P&L for last month" or "Low stock items as of today". The `SavedReport` model stores these configurations as a JSON blob alongside the report type string. Both the owner and individual staff members should be able to save their own reports, so the model is scoped by both `tenantId` and `userId`.

---

## Instructions

**Step 1: Define the SavedReport model in Prisma schema**

Open `prisma/schema.prisma`. After the existing model definitions, add a new model named `SavedReport`. The model requires the following fields: `id` as a `String` using `@id @default(cuid())`, `tenantId` as a `String` (foreign key to `Tenant`), `userId` as a `String` (foreign key to `User`), `name` as a `String` (the human-friendly label the user gives the saved configuration), `reportType` as a `String` (a freeform discriminator such as `"PROFIT_LOSS"`, `"SALES_BY_PRODUCT"`, `"REVENUE_TREND"` — not an enum so new report types can be added without schema migrations), `filters` as a `Json` field (stores the date range and any additional filter state as a plain object), `createdAt` as `DateTime @default(now())`, and `updatedAt` as `DateTime @updatedAt`.

Declare the relation back to `User` using `user User @relation(fields: [userId], references: [id], onDelete: Cascade)` and back to `Tenant` with `tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)`. Add `@@index([tenantId, userId])` to allow efficient queries filtering by both dimensions simultaneously.

On the `User` model, add the back-relation field `savedReports SavedReport[]`. On the `Tenant` model, add `savedReports SavedReport[]`.

**Step 2: Run the Prisma migration**

In the terminal, run `pnpm prisma migrate dev --name add_saved_report_model`. Prisma will generate the SQL migration file and apply it to the development database. Verify that the migration completes without errors and that `prisma generate` runs automatically afterwards to update the Prisma Client types.

**Step 3: Create the API route handler file**

Create the file at `src/app/api/reports/saved/route.ts`. This file will export two named async functions: `GET` and `POST`.

**Step 4: Implement the GET handler**

The GET handler must first call `getServerSession` from NextAuth to retrieve the current session. If no session exists, return a `401` JSON response. Extract the `tenantId` from the session (stored on the session object in the NextAuth configuration). Call `prisma.savedReport.findMany` with a `where` clause filtering by `tenantId` and `userId` equal to the session user's id. Order results by `createdAt` descending. Return the records as a JSON array with a `200` status.

**Step 5: Implement the POST handler**

The POST handler reads the request JSON body and extracts `name`, `reportType`, and `filters`. Validate that `name` is a non-empty string, `reportType` is a non-empty string, and `filters` is an object. If validation fails, return a `400` JSON response with a descriptive `error` field. Authenticate the session and, on success, call `prisma.savedReport.create` with the `tenantId` from the session, `userId` from the session, and the three body fields. Return the created record with a `201` status.

**Step 6: Add Zod validation schema**

Rather than inline validation, create the input schema using Zod in the same route file. Define a `savedReportSchema` object with `name` as `z.string().min(1).max(100)`, `reportType` as `z.string().min(1)`, and `filters` as `z.record(z.unknown())` to accept any object shape. Use `safeParse` on the request body before writing to the database. On a parse error, return the formatted Zod error array in the `400` response so the client can display field-level errors.

---

## Expected Output

- `SavedReport` model present in `prisma/schema.prisma` with all required fields, relations, and index.
- Migration file generated at `prisma/migrations/[timestamp]_add_saved_report_model/migration.sql`.
- Prisma Client regenerated with `SavedReport` CRUD types available.
- `GET /api/reports/saved` returns an array of saved reports for the authenticated user's tenant.
- `POST /api/reports/saved` creates a new record and returns it with status `201`.
- Both endpoints return `401` when called without a valid session.

---

## Validation

- [ ] `pnpm prisma migrate dev` completes with no errors for this migration.
- [ ] Prisma Studio shows the `SavedReport` table with correct columns.
- [ ] GET endpoint returns `[]` for a tenant with no saved reports (not a 404 or 500).
- [ ] POST endpoint with valid body creates a record and the response contains the generated `id`.
- [ ] POST endpoint with an empty `name` returns a `400` with a Zod validation message.
- [ ] GET endpoint is scoped: saved reports from Tenant A do not appear for a user in Tenant B.
- [ ] `@@index([tenantId, userId])` appears in the generated SQL migration.

---

## Notes

- The `reportType` field is intentionally a plain `String` rather than an enum so that adding new report pages in future subphases does not require a schema migration each time.
- The `filters` Json field should store the serialised form of the `DateRange` and any secondary filters (product category, staff member, etc.) as defined by each report page's filter state shape.
- A DELETE endpoint for removing saved reports should be added in a follow-up task once the UI for managing saved reports is built; it is out of scope for this task.
