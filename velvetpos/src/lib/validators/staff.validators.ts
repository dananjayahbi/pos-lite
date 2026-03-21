import { z } from 'zod';

const StaffRole = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK']);

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
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
