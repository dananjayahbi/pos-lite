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

const EntryDateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date' });

/**
 * "Add Cash In" payload. `sourceAccountId` is optional: when provided the
 * top-up is a transfer from that account (both ledgers move); when omitted the
 * cash enters the business from outside and only the petty-cash account is
 * debited.
 */
export const TopUpPettyCashSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isFinite(value), { message: 'Amount must be a number' })
    .refine((value) => value > 0, { message: 'Amount must be greater than zero' }),
  sourceAccountId: z.string().min(1).nullable().optional(),
  description: z.string().trim().max(200).optional(),
  entryDate: EntryDateSchema.optional(),
});

export type TopUpPettyCashInput = z.infer<typeof TopUpPettyCashSchema>;
