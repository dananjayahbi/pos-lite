/**
 * ARGUS #396 - export the expense register, not a single fund's audit trail.
 *
 * Kept pure so the column mapping, category labels and CSV safety rules can be
 * tested without a database. The route feeds it rows from the same filters the
 * list uses (category and inclusive date range), across every account.
 */
import { neutralizeCsvFormula, toCsv, type CsvColumn } from '@/lib/export';
import {
  EXPENSE_ACCOUNT_EMPTY_LABEL,
  resolveExpenseAccountLabel,
} from '@/lib/expenses/account-label';

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  SALARIES: 'Salaries',
  UTILITIES: 'Utilities',
  ADVERTISING: 'Advertising',
  MAINTENANCE: 'Maintenance',
  MISCELLANEOUS: 'Miscellaneous',
  OTHER: 'Other',
  STAFF_MEALS: 'Staff Meals',
  TEA_SUGAR: 'Tea & Sugar',
  OFFICE_STATIONERY: 'Office Stationery',
  TRAVEL: 'Travel',
  STAFF_COMMISSIONS: 'Staff Commissions',
};

export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category] ?? category;
}

export interface ExpenseRegisterRow {
  expenseDate: string | Date;
  category: string;
  description: string;
  amount: string | number | { toString(): string };
  receiptImageUrl?: string | null;
  paymentAccountId?: string | null;
  paymentAccount?: { id?: string | null; name?: string | null } | null;
  pettyCashFundId?: string | null;
  pettyCashFund?: { id?: string | null; name?: string | null } | null;
  recordedByEmail?: string | null;
  recordedBy?: { email?: string | null } | null;
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function formatAmount(value: string | number | { toString(): string }): string {
  const amount = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(amount) ? amount.toFixed(2) : value.toString();
}

/** Keep the unlinked placeholder literal; neutralise real text for CSV safety. */
function safeText(value: string): string | number | null | undefined {
  return value === EXPENSE_ACCOUNT_EMPTY_LABEL ? value : neutralizeCsvFormula(value);
}

export function buildExpenseRegisterCsv(rows: ExpenseRegisterRow[]): string {
  const columns: CsvColumn<ExpenseRegisterRow>[] = [
    { header: 'Date', value: (row) => formatDate(row.expenseDate) },
    { header: 'Category', value: (row) => safeText(expenseCategoryLabel(row.category)) },
    { header: 'Description', value: (row) => safeText(row.description) },
    {
      header: 'Account',
      value: (row) =>
        safeText(
          resolveExpenseAccountLabel({
            paymentAccountId: row.paymentAccountId,
            paymentAccount: row.paymentAccount,
            pettyCashFundId: row.pettyCashFundId,
            pettyCashFund: row.pettyCashFund,
          }).label,
        ),
    },
    { header: 'Amount', value: (row) => formatAmount(row.amount) },
    { header: 'Receipt URL', value: (row) => safeText(row.receiptImageUrl ?? '') },
    {
      header: 'Recorded By',
      value: (row) => safeText(row.recordedByEmail ?? row.recordedBy?.email ?? ''),
    },
  ];

  return toCsv(columns, rows);
}

export function expenseRegisterFilename(now: Date = new Date()): string {
  return `expense-register-${now.toISOString().slice(0, 10)}.csv`;
}
