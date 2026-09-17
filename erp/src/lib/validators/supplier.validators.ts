import { z } from 'zod';
import { SL_PHONE_REGEX } from '@/lib/constants/supplier';
import { zSriLankaPhone } from '@/lib/validators/shared';

/**
 * M14-03: the supplier phone fields now share the `zSriLankaPhone` primitive
 * instead of inlining `.regex(SL_PHONE_REGEX, …)`. The supplier contract is
 * kept EXACTLY as Module 06 verified it — same grammar (`pattern`) and the
 * verbatim storage form (`normalize: false`; the service re-checks the raw
 * value), so only separator-stripping is added. Customers use the normalizing
 * default (0XXXXXXXXX → +94XXXXXXXXX) to unify @@unique([tenantId, phone]).
 */
const supplierPhone = () =>
  zSriLankaPhone({
    pattern: SL_PHONE_REGEX,
    normalize: false,
    message: 'Use +94XXXXXXXXX or 07XXXXXXXX',
  });

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  contactName: z.string().max(100).optional(),
  phone: supplierPhone(),
  whatsappNumber: supplierPhone().optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  leadTimeDays: z.int().min(1).max(365).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
