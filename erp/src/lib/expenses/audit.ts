/**
 * ARGUS #401 - expense edits need a durable before/after trail.
 *
 * Kept pure so the snapshot shape and the changed-field decision are testable
 * without a database. The service writes the snapshot through the same
 * transaction as the expense/ledger mutation.
 */
export interface ExpenseAuditSource {
  category: string;
  amount: string | number | { toString(): string };
  description: string;
  expenseDate: string | Date;
  receiptImageUrl?: string | null;
  pettyCashFundId?: string | null;
  paymentAccountId?: string | null;
}

export interface ExpenseAuditSnapshot {
  category: string;
  amount: number;
  description: string;
  expenseDate: string;
  receiptImageUrl: string | null;
  pettyCashFundId: string | null;
  paymentAccountId: string | null;
}

function toAmount(value: ExpenseAuditSource['amount']): number {
  const numeric =
    typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
}

function toIsoDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function expenseAuditSnapshot(expense: ExpenseAuditSource): ExpenseAuditSnapshot {
  return {
    category: expense.category,
    amount: toAmount(expense.amount),
    description: expense.description,
    expenseDate: toIsoDate(expense.expenseDate),
    receiptImageUrl: expense.receiptImageUrl ?? null,
    pettyCashFundId: expense.pettyCashFundId ?? null,
    paymentAccountId: expense.paymentAccountId ?? null,
  };
}

export function expenseChangedFields(
  before: ExpenseAuditSnapshot,
  after: ExpenseAuditSnapshot,
): Array<keyof ExpenseAuditSnapshot> {
  const fields: Array<keyof ExpenseAuditSnapshot> = [
    'category',
    'amount',
    'description',
    'expenseDate',
    'receiptImageUrl',
    'pettyCashFundId',
    'paymentAccountId',
  ];
  return fields.filter((field) => before[field] !== after[field]);
}
