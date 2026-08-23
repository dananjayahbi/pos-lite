import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';

export const UpdatePettyCashFundSchema = z.object({
  fundId: z.string().cuid(),
  name: z.string().min(1).max(80).optional(),
  openingBalance: z.number().min(0).optional(),
  lowBalanceThreshold: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  activeCategories: z.array(z.enum(EXPENSE_CATEGORIES)).optional(),
});

export type UpdatePettyCashFundInput = z.infer<typeof UpdatePettyCashFundSchema>;
