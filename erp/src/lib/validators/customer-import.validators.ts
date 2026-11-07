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
/**
 * Canonical CSV columns. The download template, the page copy and the row
 * schema all consume this list so they cannot drift apart.
 */
export const CUSTOMER_IMPORT_COLUMNS = [
  'Name',
  'Phone',
  'Phone2',
  'Email',
  'Address',
  'City',
  'Gender',
  'Birthday',
  'Tags',
  'Notes',
] as const;

/** Header line written by "Download Template" (trailing newline included). */
export const CUSTOMER_IMPORT_TEMPLATE_CSV = `${CUSTOMER_IMPORT_COLUMNS.join(',')}\n`;

export const CustomerCsvRowSchema = z.object({
  Name: z.string().trim().min(1, 'Name is required').max(100),
  Phone: zSriLankaPhone({
    message: 'Phone must be a 10-digit Sri Lankan number (07XXXXXXXX)',
  }),
  // Secondary contact mirrors the New/Edit Customer drawer: optional, and a
  // non-empty value must be a valid Sri Lankan number.
  Phone2: z.union([z.literal(''), zSriLankaPhone()]).optional(),
  Email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  Address: z.string().trim().max(250, 'Address must be 250 characters or fewer').optional().or(z.literal('')),
  City: z.string().trim().max(100, 'City must be 100 characters or fewer').optional().or(z.literal('')),
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
