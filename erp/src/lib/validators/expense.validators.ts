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
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
