import { z } from 'zod';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from '@/lib/constants/permissions';
import { zSriLankaPhone } from '@/lib/validators/shared';

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

/** Optional free-text field. Empty strings are normalized by the service. */
const optionalText = (max: number) => z.string().trim().max(max).optional();

/**
 * Optional salary/allowance input. Accepts a number or decimal string, allows
 * an empty string (clear on update), and bounds the Decimal(12,2) column.
 */
const optionalMoney = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'Must be a valid amount with at most 2 decimal places',
  })
  .refine((value) => value === '' || Number(value) <= 999_999_999.99, {
    message: 'Amount is too large',
  })
  .optional();

/** Sri Lankan NIC: 9 digits + V/X or the newer 12-digit format. */
const NicSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^(\d{9}[VvXx]|\d{12})$/, 'Enter a valid NIC (9 digits + V/X or 12 digits)'),
  ])
  .optional();

/** Optional secondary/contact number using the shared SL phone contract. */
const ContactNumberSchema = z.union([z.literal(''), zSriLankaPhone()]).optional();

const staffProfileFields = {
  fullName: optionalText(100),
  nic: NicSchema,
  contactNumber: ContactNumberSchema,
  address: optionalText(500),
  basicSalary: optionalMoney,
  allowances: optionalMoney,
  bankName: optionalText(100),
  bankBranch: optionalText(100),
  bankAccountNumber: optionalText(50),
  etfNumber: optionalText(50),
  epfNumber: optionalText(50),
} as const;

export const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: StaffRole,
  commissionRate: CommissionRateSchema.optional(),
  ...staffProfileFields,
});

export const UpdateStaffSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  role: StaffRole.optional(),
  isActive: z.boolean().optional(),
  commissionRate: CommissionRateSchema.optional(),
  permissions: z.array(PermissionValueSchema).optional(),
  ...staffProfileFields,
});

export const StaffListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: StaffRole.optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
export type StaffListQuery = z.infer<typeof StaffListQuerySchema>;
