import { z } from 'zod';
import { SL_PHONE_REGEX } from '@/lib/constants/supplier';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  contactName: z.string().max(100).optional(),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .regex(SL_PHONE_REGEX, 'Use +94XXXXXXXXX or 07XXXXXXXX'),
  whatsappNumber: z
    .string()
    .regex(SL_PHONE_REGEX, 'Use +94XXXXXXXXX or 07XXXXXXXX')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  leadTimeDays: z.int().min(1).max(365).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
