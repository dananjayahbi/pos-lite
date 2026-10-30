import { z } from 'zod';

import { PaymentAccountStatus, PaymentAccountType, PaymentEntrySource } from '@/generated/prisma/client';

/** Money input — accepts a number or a numeric string, rejects NaN/negatives. */
const money = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine((value) => Number.isFinite(value), { message: 'Amount must be a number' })
  .refine((value) => value >= 0, { message: 'Amount cannot be negative' });

const positiveMoney = money.refine((value) => value > 0, {
  message: 'Amount must be greater than zero',
});

const details = z
  .array(
    z.object({
      label: z.string().trim().max(60),
      value: z.string().trim().max(200),
    }),
  )
  .max(20)
  .optional();

export const PaymentAccountTypeSchema = z.nativeEnum(PaymentAccountType);
export const PaymentAccountStatusSchema = z.nativeEnum(PaymentAccountStatus);

export const CreatePaymentAccountSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  type: PaymentAccountTypeSchema,
  accountNumber: z.string().trim().max(60).optional(),
  openingBalance: money.default(0),
  details: details,
  note: z.string().trim().max(500).optional(),
});

export const UpdatePaymentAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    type: PaymentAccountTypeSchema.optional(),
    accountNumber: z.string().trim().max(60).nullable().optional(),
    details: details,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

/**
 * A date-only or ISO timestamp. Stored as a real `Date` so callers never
 * persist a string; mirrors `SaleDateSchema`'s behaviour.
 */
const EntryDateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date' });

export const FundTransferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: positiveMoney,
    entryDate: EntryDateSchema.optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: 'Source and destination accounts must differ',
    path: ['toAccountId'],
  });

export const DepositSchema = z.object({
  // Null/omitted = money entering the business from outside (owner's own cash),
  // in which case a counter-account is not required.
  fromAccountId: z.string().min(1).nullable().optional(),
  amount: positiveMoney,
  entryDate: EntryDateSchema.optional(),
  note: z.string().trim().max(300).optional(),
});

export const WithdrawalSchema = z.object({
  toAccountId: z.string().min(1).nullable().optional(),
  amount: positiveMoney,
  entryDate: EntryDateSchema.optional(),
  note: z.string().trim().max(300).optional(),
});

export const CloseAccountSchema = z.object({
  // Where the remaining balance should go. Required when balance != 0.
  transferToAccountId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(300).optional(),
});

export const PaymentAccountListQuerySchema = z.object({
  status: PaymentAccountStatusSchema.optional(),
  type: PaymentAccountTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const AccountBookQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  source: z.nativeEnum(PaymentEntrySource).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreatePaymentAccountInput = z.infer<typeof CreatePaymentAccountSchema>;
export type UpdatePaymentAccountInput = z.infer<typeof UpdatePaymentAccountSchema>;
export type FundTransferInput = z.infer<typeof FundTransferSchema>;
export type DepositInput = z.infer<typeof DepositSchema>;
export type WithdrawalInput = z.infer<typeof WithdrawalSchema>;
export type CloseAccountInput = z.infer<typeof CloseAccountSchema>;
