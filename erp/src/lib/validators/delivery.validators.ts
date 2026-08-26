import { z } from 'zod';

// Enum values mirrored from the Prisma schema. Keep in sync with the
// `DeliverySource`, `DeliveryStatus`, and `WaybillMode` enums in
// `schema.prisma`. Defined locally (not imported from the Prisma client) so
// this validator stays bundle-safe for client components — the Prisma client
// requires Node built-ins (`node:module`) and cannot run in the browser.
export const DELIVERY_SOURCES = [
  'WEBSITE_CHECKOUT',
  'ERP_MANUAL',
  'POS',
  'IMPORT',
] as const;

export const DELIVERY_STATUSES = [
  'PLACED',
  'PENDING_DISPATCH',
  'HOLD',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELED',
  'RETURNED',
  'PENDING_PICKUP',
] as const;

export const WAYBILL_MODES = ['MANUAL', 'AUTO'] as const;

export type DeliverySource = (typeof DELIVERY_SOURCES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type WaybillMode = (typeof WAYBILL_MODES)[number];

/** Shipping address block reused by create/update. */
export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1, 'Recipient name is required').max(120),
  phone: z.string().min(1, 'Phone is required').max(20),
  phone2: z.string().max(20).optional(),
  addressLine1: z.string().min(1, 'Address is required').max(255),
  addressLine2: z.string().max(255).optional(),
  districtId: z.coerce.number().int().optional(),
  districtName: z.string().max(120).optional(),
  cityId: z.coerce.number().int().optional(),
  cityName: z.string().min(1, 'City is required').max(120),
  postalCode: z.string().max(20).optional(),
});

export const CreateDeliverySchema = z.object({
  source: z.enum(DELIVERY_SOURCES).optional(),
  customerId: z.string().cuid().optional(),
  saleId: z.string().cuid().optional(),
  codAmount: z.coerce.number().nonnegative('COD amount cannot be negative').optional(),
  declaredValue: z.coerce.number().nonnegative().optional(),
  itemCount: z.coerce.number().int().min(1).default(1),
  totalWeightKg: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  assignedStaffId: z.string().cuid().optional(),
  address: ShippingAddressSchema,
});

export const UpdateDeliverySchema = z.object({
  codAmount: z.coerce.number().nonnegative().optional(),
  declaredValue: z.coerce.number().nonnegative().optional(),
  itemCount: z.coerce.number().int().min(1).optional(),
  totalWeightKg: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  assignedStaffId: z.string().cuid().nullable().optional(),
  address: ShippingAddressSchema.optional(),
});

export const DispatchDeliverySchema = z.object({
  waybillMode: z.enum(WAYBILL_MODES).default('AUTO'),
  manualWaybillId: z
    .string()
    .trim()
    .min(8, 'Manual waybill id is required (at least 8 characters)')
    .max(40)
    .optional(),
});

export const CancelDeliverySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const DeliveryFiltersSchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
  source: z.enum(DELIVERY_SOURCES).optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type CreateDeliveryInput = z.infer<typeof CreateDeliverySchema>;
export type UpdateDeliveryInput = z.infer<typeof UpdateDeliverySchema>;
export type DispatchDeliveryInput = z.infer<typeof DispatchDeliverySchema>;
export type CancelDeliveryInput = z.infer<typeof CancelDeliverySchema>;
export type DeliveryFilters = z.infer<typeof DeliveryFiltersSchema>;
export type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;
