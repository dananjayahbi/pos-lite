# Payroll (Run payroll + reports & bank sheets)

Monthly salary processing for Sri Lankan statutory payroll. The feature adds two
navigation entries under **HR & Payroll**:

- **Run Payroll** (`/payroll`)
- **Payroll Reports & Bank Sheets** (`/payroll/reports`)

## Salary formula

```
Gross salary   = Basic salary + Allowances + Overtime amount + Sales commission
Deductions     = No-pay deduction + Salary advances
Employee EPF   = 8% of gross salary           (deducted from the employee)
Employer EPF   = 12% of gross salary          (company expense)
Employer ETF   = 3% of gross salary           (company expense)
Net salary     = Gross salary - Deductions - Employee EPF
Company cost   = Gross salary + Employer EPF + Employer ETF
```

The pure implementation is `src/lib/payroll/calculations.ts` and is covered by
unit tests. It uses `Decimal` and half-up cent rounding, matching the rest of the
money code.

### Inputs and how they are derived

| Component | Source |
| --- | --- |
| Basic salary | `User.basicSalary` (staff profile) |
| Allowances | `User.allowances` |
| Overtime | Attendance/timeclock OT minutes for the month × `basic / (workingDays × 8) × OT multiplier` |
| Sales commission | Unpaid `CommissionRecord` rows for the month (paid commission is never paid twice) |
| No-pay days | `ABSENT` days + 0.5 × `HALF_DAY` days; approved `LEAVE` stays paid |
| Salary advances | Entered per employee in the preview before generating (persisted on the payroll item) |

No-pay days and advances are editable in the preview. The server re-derives
basic, allowances, OT and commission; it never trusts client-supplied money.

### Working days and rates

Default working days are the Monday–Friday count of the selected month. A tenant
can override it in **Payroll settings** on the Run Payroll page. The overtime
multiplier defaults to 1.5. Statutory rates are fixed at 8/12/3 percent and are
stored on each payroll run so historical payslips keep the rates that were
applied.

## Workflow

1. Open **Run Payroll** and choose the month.
2. Review the live preview (basic, allowances, OT, commission, no-pay, advance,
   employee EPF, net).
3. Adjust no-pay days / advances where needed.
4. **Generate payroll** — creates an immutable `PayrollRun` + `PayrollItem`
   snapshot. A month can only be generated once.
5. Open **Payroll Reports & Bank Sheets** to print/email payslips and download
   the bank and statutory files.

Generating a run also creates a `CommissionPayout` for the unpaid commission
records included in the run and marks them paid, so the Staff Commissions page
cannot pay the same commission twice.

## Payslips

`src/lib/payroll/payslip-pdf.ts` renders a branded A4 PDF:

- tenant logo (from Store Profile `logoUrl`), company name, address and phone;
- employee details, NIC, EPF/ETF numbers and bank account;
- earnings: basic, allowances, OT (hours + amount), commission, gross;
- deductions: no-pay, advances, employee EPF, total;
- employer EPF/ETF (company cost);
- highlighted net salary.

Actions on `/payroll/reports`:

- **Print** — opens the PDF in a new tab; use the browser's print dialog.
- **Download** — downloads the payslip PDF.
- **Email** — sends the PDF as an attachment through Resend
  (`RESEND_API_KEY`). Without a configured provider the payslip is marked
  `NOT_CONFIGURED` and the UI shows a warning — it is never silently marked as
  sent.

## Reports & bank sheets

All exports use the generated (immutable) run for the selected month:

| Export | Formats | Contents |
| --- | --- | --- |
| Bank salary sheet | XLSX, PDF | Employee name, bank, branch, account number, net salary, total — ready for corporate-banking batch upload |
| EPF / ETF monthly returns | XLSX (2 sheets), PDF (2 pages) | C-Form style: NIC, EPF/ETF number, total earnings, employee 8%, employer 12%, employer ETF 3% |
| Monthly payroll summary | PDF, XLSX | Company cost breakdown + per-employee table |

Routes:

```
GET /api/store/payroll/runs/[id]/exports/bank-sheet?format=xlsx|pdf
GET /api/store/payroll/runs/[id]/exports/statutory?format=xlsx|pdf
GET /api/store/payroll/runs/[id]/exports/summary?format=xlsx|pdf
GET /api/store/payroll/runs/[id]/payslips/[userId]
POST /api/store/payroll/runs/[id]/payslips/[userId]/email
```

## Permissions

| Permission | Owner | Manager | Cashier |
| --- | --- | --- | --- |
| `payroll:view` | ✓ | ✓ | — |
| `payroll:run` | ✓ | ✓ | — |
| `payroll:settings:manage` | ✓ | ✓ | — |

An employee can download their own payslip (self-check) via the payslip route
even without `payroll:view`.

## Data model

Added to `prisma/schema.prisma`:

- `PayrollRun` — month (`YYYY-MM`), period, working days, applied rates, totals,
  generator and status.
- `PayrollItem` — per-employee snapshot of all earnings, deductions, statutory
  contributions, bank/statutory identifiers and email delivery state.
- `PayrollRunStatus` enum (`DRAFT`, `GENERATED`, `PAID`).

There is no migrations folder in this repository; apply the schema with the
project's normal Prisma workflow (`npx prisma db push` or the deployment's
equivalent) before using the feature.

## Tests

```
npx vitest run src/lib/payroll
```

- `calculations.test.ts` — gross/net/EPF/ETF, OT, no-pay, advances, caps.
- `payroll-settings.test.ts` — parsing/defaults/working-day resolution.
- `documents.test.ts` — payslip PDF, bank sheet XLSX/PDF, EPF/ETF returns,
  summary report render without errors.
