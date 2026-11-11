# Staff onboarding: HR profile fields

The New/Edit Staff forms now collect the full HR profile requested by the
client. All fields are optional in the API so existing integrations and QA
fixtures that only send `email` + `role` keep working.

## Fields

| Section | Field | Column | Notes |
| --- | --- | --- | --- |
| Personal & access | Full Name | `users.fullName` | Used as the staff display name when present; falls back to the email-derived label. |
| | Email | `users.email` | Required on create, unique. |
| | Role | `users.role` | Required on create. |
| | NIC | `users.nic` | Optional; 9 digits + V/X or 12 digits. |
| | Contact Number | `users.contactNumber` | Optional; shared Sri Lankan phone validation/normalisation. |
| | Address | `users.address` | Optional free text (≤500). |
| | System Access Password | `users.passwordHash` | Form field; hashed server-side via the existing staff password endpoint. |
| Salary & allowances | Basic Salary (LKR) | `users.basicSalary` | Decimal(12,2); used for ETF/EPF calculations. |
| | Allowances (LKR) | `users.allowances` | Decimal(12,2). |
| Banking & statutory | Bank Name | `users.bankName` | Optional. |
| | Branch | `users.bankBranch` | Optional. |
| | Account Number | `users.bankAccountNumber` | Optional. |
| | ETF Number | `users.etfNumber` | Optional. |
| | EPF Number | `users.epfNumber` | Optional. |

Migration `20261106040000_add_staff_hr_fields` adds the nullable columns to
`users`.

## API

`POST /api/store/staff` and `PATCH /api/store/staff/[id]` accept the fields
above through `CreateStaffSchema` / `UpdateStaffSchema`:

- money fields accept a decimal string with at most 2 dp and are bounded to
  `999,999,999.99` (the `Decimal(12,2)` ceiling);
- NIC accepts `#########V/X` or 12 digits;
- contact numbers use the shared `zSriLankaPhone()` normaliser;
- empty strings are accepted so the edit form can clear nullable fields.

`GET /api/store/staff/[id]` and the list endpoint return every field, and the
staff detail page shows them in the **HR & Statutory Details** card.

## UI

- The create dialog is grouped into **Personal & access**, **Salary &
  allowances**, and **Banking & statutory**, and scrolls within the viewport.
- The edit dialog mirrors the same groups and pre-fills every value.
- The staff list shows the full name (falling back to the email-derived label)
  with the contact number underneath.
- The staff detail header uses the full name, and the payslip PDF uses it too.
- The attendance view also prefers the full name when present.

## Password behaviour

The create form's **System Access Password** is optional. When supplied, the
client creates the account and then calls
`POST /api/store/staff/[id]/password` (the existing audited, session-invalidating
route). If it is left empty, the account cannot sign in until an owner sets a
password later.

## Tests

`src/lib/validators/__tests__/staff.validators.test.ts` covers the full payload,
NIC formats, phone normalisation, money bounds, optional-field backward
compatibility, partial updates, and clearing nullable fields.
