import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'RENT',
  'SALARIES',
  'UTILITIES',
  'ADVERTISING',
  'MAINTENANCE',
  'MISCELLANEOUS',
  'OTHER',
  'STAFF_MEALS',
  'TEA_SUGAR',
  'OFFICE_STATIONERY',
  'TRAVEL',
] as const;

export const CreateExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  expenseDate: z.string().min(1),
  receiptImageUrl: z.string().url().optional(),
  pettyCashFundId: z.string().cuid().optional(),
  // Which payment account the money left. Every expense should name one — it is
  // what makes the cash-flow report reconcile — but it stays optional so the
  // petty-cash path (which already debits the fund) keeps working unchanged.
  paymentAccountId: z.string().min(1).optional(),
  // M19-01 (D2): explicit manager approval to let a linked expense overdraw the
  // petty-cash fund. The route additionally checks the actor's permission.
  overdrawApproved: z.boolean().optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
