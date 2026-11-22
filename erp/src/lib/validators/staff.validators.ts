import { z } from 'zod';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from '@/lib/constants/permissions';
import { zSriLankaPhone } from '@/lib/validators/shared';
import {
  COMMISSION_RATE_BOUND_MESSAGE,
  COMMISSION_RATE_MAX,
} from '@/lib/constants/commission-rate';

/**
 * M03-01 (BUG-3): the role enum is derived from the shared ASSIGNABLE_ROLES
 * constant (permissions.ts — the same source both role dropdowns consume),
 * so the API can no longer reject a role the editor advertises. DISPATCH_STAFF
 * was the casualty of the old hand-written list.
 */
const StaffRole = z.enum(ASSIGNABLE_ROLES as [AssignableRole, ...AssignableRole[]]);
const PermissionValueSchema = z.string().refine(
  (value) => {
    // ARGUS #464: a `!key` entry revokes a role default for one user.
    const key = value.startsWith('!') ? value.slice(1) : value;
    return ALL_PERMISSIONS.includes(key as (typeof ALL_PERMISSIONS)[number]);
  },
  { message: 'Invalid permission value' },
);

/**
 * ARGUS #342: the contract is 0-100 percent everywhere. The old bound mirrored
 * Decimal(5,2) and accepted 999.99, while the form capped at 100 and the
 * commission engine rejected >100, so the account silently earned nothing.
 * Shape is checked first, then the shared inclusive ceiling.
 */
const CommissionRateSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal (e.g. 5.00)')
  .refine((value) => Number(value) <= COMMISSION_RATE_MAX, {
    message: COMMISSION_RATE_BOUND_MESSAGE,
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
