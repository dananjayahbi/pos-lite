import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  category: z.enum([
    'RENT',
    'SALARIES',
    'UTILITIES',
    'ADVERTISING',
    'MAINTENANCE',
    'MISCELLANEOUS',
    'OTHER',
  ]),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  expenseDate: z.string().min(1),
  receiptImageUrl: z.string().url().optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
