import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/lib/constants/permissions';

const StaffRole = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK']);
const PermissionValueSchema = z.string().refine((value) => ALL_PERMISSIONS.includes(value as (typeof ALL_PERMISSIONS)[number]), {
  message: 'Invalid permission value',
});

export const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: StaffRole,
  commissionRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal (e.g. 5.00)')
    .optional(),
});

export const UpdateStaffSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  role: StaffRole.optional(),
  isActive: z.boolean().optional(),
  commissionRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal (e.g. 5.00)')
    .optional(),
  clearPin: z.boolean().optional(),
  permissions: z.array(PermissionValueSchema).optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
