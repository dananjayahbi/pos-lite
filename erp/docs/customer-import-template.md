# Customer CSV import template

The Import Customers page (`/customers/import`) and the API endpoint
(`POST /api/store/customers/import`) share one canonical column list:

```
Name, Phone, Phone2, Email, Address, City, Gender, Birthday, Tags, Notes
```

`CUSTOMER_IMPORT_COLUMNS` and `CUSTOMER_IMPORT_TEMPLATE_CSV` live in
`src/lib/validators/customer-import.validators.ts`. The **Download Template**
button writes `CUSTOMER_IMPORT_TEMPLATE_CSV` verbatim, and the same list is
rendered as the page's CSV-format hint — so the template, the copy and the row
schema cannot drift apart. A unit test asserts the schema keys equal the
canonical order.

## Columns

| Column | Required | Notes |
| --- | --- | --- |
| `Name` | yes | 1–100 characters. |
| `Phone` | yes | `07XXXXXXXX` or `+94XXXXXXXXX`; normalized to `+94XXXXXXXXX`. |
| `Phone2` | no | Optional secondary contact; same phone validation as `Phone`. |
| `Email` | no | Valid email; stored lowercase. |
| `Address` | no | Up to 250 characters. Quote cells that contain commas. |
| `City` | no | Up to 100 characters; stored exactly as entered. |
| `Gender` | no | `MALE`, `FEMALE`, `OTHER` (case-insensitive). |
| `Birthday` | no | `YYYY-MM-DD`. |
| `Tags` | no | Comma-separated inside one quoted cell, e.g. `"VIP,IMPORT"`. |
| `Notes` | no | Up to 500 characters. |

## Import behaviour

- Header row is required. `Name` and `Phone` must be present; any other column
  may be omitted so old CSV files still import.
- Missing required headers return `400 INVALID_HEADERS` with the expected
  column list.
- A UTF-8 BOM and surrounding whitespace on headers are stripped, so files
  re-saved by Excel still import.
- Rows with a duplicate phone (against existing customers or earlier rows in
  the same file) are skipped and listed in `skippedDetails`.
- Invalid rows are not imported; the response returns their row numbers and
  validation messages in `errorDetails`.
- Limits: 2 MB and 500 rows.

## Example

```csv
Name,Phone,Phone2,Email,Address,City,Gender,Birthday,Tags,Notes
Nimal Perera,0771234567,0712345678,nimal@example.com,"12 Galle Road, Colombo 03",Colombo,MALE,1990-01-02,"VIP,REGULAR",Prefers SMS
Walk-in Customer,0771234568,,,,,,,,
```

The template download itself contains only the header row, so it can never
inject sample customers.

## Tests

`src/lib/validators/__tests__/customer-import.validators.test.ts` covers:

- required `Name`/`Phone` and phone normalization,
- `Phone2` acceptance/normalization/rejection,
- `Address`/`City` bounds and empty values,
- the canonical column order and exact template header line.
