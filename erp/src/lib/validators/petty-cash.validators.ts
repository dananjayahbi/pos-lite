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
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date' })
  // ARGUS #413: allow "today" from any timezone, reject postings further ahead.
  // The balance is incremented immediately, so a future-dated top-up would
  // overstate the current balance until that date arrives.
  .refine((value) => value.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: 'Date cannot be in the future',
  });

export const TOP_UP_SOURCE_TYPES = ['EXTERNAL', 'ACCOUNT'] as const;
export type TopUpSourceType = (typeof TOP_UP_SOURCE_TYPES)[number];

/**
 * "Add Cash In" payload. The source path is explicit (ARGUS #413):
 *
 * - `EXTERNAL` records cash entering the business from outside; no bank account
 *   is debited.
 * - `ACCOUNT` is a real transfer and requires `sourceAccountId`; the source
 *   account is credited in the same transaction as the petty-cash debit.
 *
 * `sourceType` is optional for older clients and is inferred from
 * `sourceAccountId` when omitted.
 */
export const TopUpPettyCashSchema = z
  .object({
    amount: z
      .union([z.number(), z.string()])
      .transform((value) => (typeof value === 'number' ? value : Number(value)))
      .refine((value) => Number.isFinite(value), { message: 'Amount must be a number' })
      .refine((value) => value > 0, { message: 'Amount must be greater than zero' }),
    sourceType: z.enum(TOP_UP_SOURCE_TYPES).optional(),
    sourceAccountId: z.string().min(1).nullable().optional(),
    description: z.string().trim().max(200).optional(),
    entryDate: EntryDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const sourceType =
      value.sourceType ?? (value.sourceAccountId ? 'ACCOUNT' : 'EXTERNAL');
    if (sourceType === 'ACCOUNT' && !value.sourceAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceAccountId'],
        message: 'Select the account the transfer came from',
      });
    }
    if (sourceType === 'EXTERNAL' && value.sourceAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceAccountId'],
        message: 'External cash cannot name a source account',
      });
    }
  })
  .transform((value) => ({
    ...value,
    sourceType:
      value.sourceType ??
      (value.sourceAccountId ? ('ACCOUNT' as const) : ('EXTERNAL' as const)),
  }));

export type TopUpPettyCashInput = z.infer<typeof TopUpPettyCashSchema>;
