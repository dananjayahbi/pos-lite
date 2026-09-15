import { z } from 'zod';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from '@/lib/constants/permissions';

/**
 * M03-01 (BUG-3): the role enum is derived from the shared ASSIGNABLE_ROLES
 * constant (permissions.ts — the same source both role dropdowns consume),
 * so the API can no longer reject a role the editor advertises. DISPATCH_STAFF
 * was the casualty of the old hand-written list.
 */
const StaffRole = z.enum(ASSIGNABLE_ROLES as [AssignableRole, ...AssignableRole[]]);
const PermissionValueSchema = z.string().refine((value) => ALL_PERMISSIONS.includes(value as (typeof ALL_PERMISSIONS)[number]), {
  message: 'Invalid permission value',
});

/**
 * M03-05 (BUG-7): the old shape-only regex let "1000.00" and 20-digit strings
 * through to parseFloat → Prisma Decimal(5,2) overflow → HTTP 500. The bound
 * is the column ceiling (D3 decision 2026-09-15: 0–999.99 — spec 03 §2.2
 * pins 999.99 accepted / 1000.00 rejected): anything wider is a typed 400
 * VALIDATION_ERROR naming the field. The 2-dp shape rule stays first.
 */
const COMMISSION_RATE_MAX = 999.99; // User.commissionRate @db.Decimal(5, 2)
const CommissionRateSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal (e.g. 5.00)')
  .refine((value) => Number(value) <= COMMISSION_RATE_MAX, {
    message: `Commission rate must be between 0 and ${COMMISSION_RATE_MAX}`,
  });

export const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: StaffRole,
  commissionRate: CommissionRateSchema.optional(),
});

export const UpdateStaffSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  role: StaffRole.optional(),
  isActive: z.boolean().optional(),
  commissionRate: CommissionRateSchema.optional(),
  permissions: z.array(PermissionValueSchema).optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
