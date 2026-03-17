# Task 04.01.06 — Build Customer CSV Import

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.06 |
| Task Name | Build Customer CSV Import |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Prerequisites | 04.01.01 (Customer model), 04.01.03 (Customer list page) |
| Output | `src/app/api/customers/import/route.ts`, `ImportCustomersSheet.tsx` component |

---

## Objective

Provide staff with a bulk CSV import facility for onboarding existing customer records from a spreadsheet. The import must parse, validate, deduplicate, and bulk-insert customer rows, returning a clear summary of what was imported, skipped, and rejected so that the user can correct and re-import any failed rows.

---

## Context

Customer CSV import is a common operational need when a store transitions to VelvetPOS from a manual system or a different software. The import is deliberately server-side: the CSV file is uploaded as multipart form data, parsed using `papaparse` on the server, validated row by row with Zod, and inserted in bulk via `prisma.customer.createMany`. The frontend is a lightweight Sheet UI on the customer list page. The import is idempotent by phone number — rows whose phone number is already present in the tenant's customer table are silently skipped.

---

## Instructions

### Step 1: Install the papaparse Dependency

Add the `papaparse` library and its TypeScript types to the project by running `pnpm add papaparse @types/papaparse` in the project root. Confirm that both packages appear in `package.json` under `dependencies` and `devDependencies` respectively before continuing.

### Step 2: Define the Expected CSV Format

The import expects the following column headers (case-insensitive, trimmed):

| Column | Required | Notes |
|---|---|---|
| Name | Yes | Full name, 1–100 characters |
| Phone | No | Stored as entered after sanitisation |
| Email | No | Valid email format if present |
| Gender | No | Must be MALE, FEMALE, or OTHER (case-insensitive); blank rows default to omitted |
| Birthday | No | ISO format YYYY-MM-DD; other formats are rejected with a row error |
| Tags | No | Comma-separated list within a single cell; each tag trimmed and uppercased |
| Notes | No | Free text, max 500 characters |

The first row must be the header row. Row order beyond the header is preserved. Empty rows are skipped silently.

### Step 3: Build the Import API Route

Create `src/app/api/customers/import/route.ts` with a `POST` handler. Authenticate via NextAuth session and extract `tenantId`.

Parse the incoming request as `multipart/form-data` using Next.js's `request.formData()`. Extract the uploaded file from the `csv` field. If no file is present, return HTTP 400 with `{ error: 'No file provided' }`. Check the file size: if it exceeds 2 MB, return HTTP 413 with `{ error: 'File size exceeds the 2 MB limit' }`. Check the content type or file extension — if it is not `.csv`, return HTTP 415.

Read the file content as a string using `file.text()`. Parse the CSV string with `papaparse.parse`, using `{ header: true, skipEmptyLines: true, trimHeaders: true }` options. If papaparse returns parser errors, return HTTP 400 with those error messages.

Check that the parsed row count does not exceed 500. If it does, return HTTP 422 with `{ error: 'Import limit is 500 rows per file. Split the file and import in batches.' }`.

### Step 4: Build the Zod Row Validation Schema

Define a Zod schema for a single CSV row, mapping the column names. Make all fields optional except `Name` which is required. The `Birthday` field: if present, validate it parses to a valid ISO date string and convert it to a JavaScript `Date`. The `Gender` field: use `z.enum(['MALE', 'FEMALE', 'OTHER'])` with a pre-process step that upper-cases the input. The `Tags` field: if present, split by comma, trim each entry, and upper-case. Sanitise all string fields using `trim()` at the schema level to remove accidental whitespace.

### Step 5: Validate All Rows and Collect Results

Iterate over the parsed rows. For each row, run the Zod schema parse inside a try-catch. Collect an `errors` array of `{ row: number, message: string }` for every row that fails validation (validation errors do not stop processing — all rows are evaluated).

For rows that pass validation, check if the customer's `phone` (when provided) already exists in the tenant's database using `prisma.customer.findFirst({ where: { tenantId, phone } })`. If a match exists, add the row to the `skipped` count. Build an array of valid, non-duplicate rows to insert.

### Step 6: Bulk Insert Valid Rows

Call `prisma.customer.createMany` with the valid rows array and `{ skipDuplicates: true }`. The `skipDuplicates` flag is a defence-in-depth measure to catch any race conditions with simultaneous imports, in addition to the pre-flight duplicate check in Step 5. The returned `count` from `createMany` represents the number of rows actually inserted.

Return HTTP 200 with `{ imported: count, skipped: skippedCount, errors: errorsArray }`.

### Step 7: Build the ImportCustomersSheet Component

Create `src/components/customers/ImportCustomersSheet.tsx` as a Client Component. The component accepts an `onSuccess` callback and renders a ShadCN `Sheet` triggered by an "Import Customers" button on the customer list page.

Inside the Sheet, render the following UI:

- A brief description paragraph explaining the expected CSV format, the column names, and the 500-row limit.
- A "Download Template" link that generates a CSV template file client-side (build a Blob from a header-only CSV string and trigger a download) so staff always have the correct column names.
- A ShadCN file input (`Input` with `type="file"` and `accept=".csv"`) labelled "Upload CSV file".
- A "Import" button that is disabled until a file is selected and enabled once a valid `.csv` file is chosen.

On clicking "Import", build a `FormData` object, append the selected file under the key `csv`, and POST it to `/api/customers/import` using a TanStack Query mutation. While the upload is in progress, show a `Loader` spinner in the button.

On success, render the result summary below the upload form in a styled result card:

- A green success row: "N customers imported successfully."
- An amber row if skipped > 0: "N rows skipped (duplicate phone numbers)."
- A red error section if errors exist: a collapsible list of `{ row, message }` entries.

Call the `onSuccess` callback after a successful import so the customer list page can refetch.

---

## Expected Output

- `src/app/api/customers/import/route.ts` — POST handler with full parse, validate, deduplicate, bulk-insert pipeline.
- `src/components/customers/ImportCustomersSheet.tsx` — upload Sheet with result display.
- Customer list page (`page.tsx`) — "Import Customers" button added that opens the Sheet.

---

## Validation

- [ ] Uploading a correctly formatted 10-row CSV imports all 10 rows and returns `{ imported: 10, skipped: 0, errors: [] }`.
- [ ] A row with a phone number that already exists for the tenant is reported as skipped, not as an error.
- [ ] A row with an invalid birthday format (e.g., "March 5") produces an entry in the `errors` array with the row number and a descriptive message.
- [ ] A file exceeding 2 MB is rejected with HTTP 413 before any parsing occurs.
- [ ] A file with more than 500 rows is rejected with HTTP 422.
- [ ] A CSV with no `Name` column header causes a parse error and the entire import is rejected before row processing.
- [ ] The "Download Template" link downloads a `.csv` file with the correct headers.

---

## Notes

- Use `papaparse`'s `header: true` option so column values are accessible by name rather than array index — this makes the Zod schema mapping cleaner and more readable.
- String sanitisation in the Zod schema (using `.trim()`) is important to prevent invisible whitespace in names or tags from causing data quality issues.
- The maximum 500-row limit exists to keep the API response within a reasonable timeframe. For larger imports, advise the user to split the file. A future enhancement would introduce a background job for larger files, but that is explicitly out of scope for Phase 04.
- The file size check (2 MB) is a defence against unexpectedly large file uploads and is checked before any parsing to fail fast.
- Do not store the uploaded file anywhere — it is processed in memory and discarded. There is no file storage required.
