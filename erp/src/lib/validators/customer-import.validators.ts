import { z } from 'zod';

import { zSriLankaPhone } from '@/lib/validators/shared';

/**
 * CSV import row for customers.
 *
 * ISSUE 8: a phone is mandatory and must be a 10-digit Sri Lankan mobile
 * (`07XXXXXXXX`) or its `+94` equivalent. The shared `zSriLankaPhone`
 * normalizes stored values to `+94XXXXXXXXX`, matching the CRM/POS create
 * paths so duplicates and reporting are consistent.
 */
export const CustomerCsvRowSchema = z.object({
  Name: z.string().trim().min(1, 'Name is required').max(100),
  Phone: zSriLankaPhone({
    message: 'Phone must be a 10-digit Sri Lankan number (07XXXXXXXX)',
  }),
  Email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  Gender: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(['MALE', 'FEMALE', 'OTHER']))
    .optional()
    .or(z.literal('')),
  Birthday: z.string().trim().optional().or(z.literal('')),
  Tags: z.string().trim().optional().or(z.literal('')),
  Notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type CustomerCsvRow = z.infer<typeof CustomerCsvRowSchema>;

/** Normalize any SL phone variant to the stored `+94XXXXXXXXX` form. */
export function normalizeSriLankaPhone(value: string): string {
  const digits = value.replace(/[\s\-().]/g, '');
  return digits.startsWith('0') ? `+94${digits.slice(1)}` : digits;
}
