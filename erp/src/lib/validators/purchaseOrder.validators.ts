import { z } from 'zod';

const POStatusEnum = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export const CreatePOLineSchema = z.object({
  variantId: z.string().min(1, 'Variant is required'),
  orderedQty: z.int().min(1, 'Quantity must be at least 1'),
  expectedCostPrice: z.number().min(0, 'Cost price must be non-negative'),
});

/**
 * A date the operator picked, as an ISO string or `yyyy-mm-dd`.
 *
 * Deliberately NOT `.transform()`ed into a `Date`: these schemas feed
 * `zodResolver` in the create form, and a transform makes zod's input and
 * output types diverge, which react-hook-form cannot reconcile. The service
 * converts with `new Date(...)` — nothing ever persists the raw string.
 */
const PODateSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid date' });

const DiscountTypeSchema = z.nativeEnum({ PERCENTAGE: 'PERCENTAGE', FIXED: 'FIXED' } as const, {
  error: 'Invalid discount type',
});

/**
 * Reference numbers are printed on the PO and quoted to suppliers, so they stay
 * printable and short. Left blank the API generates `PO-YYYYMM-####`.
 */
export const POReferenceSchema = z
  .string()
  .trim()
  .min(3, 'Reference must be at least 3 characters')
  .max(40, 'Reference must be at most 40 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, 'Use letters, digits, /, _ or - only');

export const CreatePOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  lines: z.array(CreatePOLineSchema).min(1, 'At least one line is required'),
  // Optional: generated per tenant/month when omitted.
  referenceNo: POReferenceSchema.optional(),
  // Defaults to today; lets a manager backdate a PO.
  orderDate: PODateSchema.optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  discountType: DiscountTypeSchema.nullable().optional(),
  discountValue: z.number().min(0, 'Discount cannot be negative').optional(),
  // 10 / 30 day terms, or null for immediate payment.
  paymentTermDays: z.int().min(0).max(365).nullable().optional(),
  paymentAccountId: z.string().min(1).nullable().optional(),
  // Save-as-draft vs send-immediately.
  status: z.enum(['DRAFT', 'SENT']).optional(),
});

/** Only the financially-inert, still-editable fields of a DRAFT/SENT PO. */
export const UpdatePOSchema = z
  .object({
    referenceNo: POReferenceSchema.optional(),
    orderDate: PODateSchema.optional(),
    expectedDeliveryDate: z.string().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    discountType: DiscountTypeSchema.nullable().optional(),
    discountValue: z.number().min(0).optional(),
    paymentTermDays: z.int().min(0).max(365).nullable().optional(),
    paymentAccountId: z.string().min(1).nullable().optional(),
    lines: z.array(CreatePOLineSchema).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

/**
 * Pay a PO from a payment account. `paymentAccountId` must reference an ACTIVE
 * account; the service checks balance and posts the ledger entry.
 */
export const PayPurchaseOrderSchema = z.object({
  paymentAccountId: z.string().min(1, 'Payment account is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  paidAt: PODateSchema.optional(),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

export const ReceivePOLineSchema = z.object({
  lineId: z.string().min(1, 'Line ID is required'),
  receivedQty: z.int().min(1, 'Received quantity must be at least 1'),
  actualCostPrice: z.number().min(0).optional(),
  batchNumber: z.string().trim().min(1).optional(),
  expiryDate: z.string().datetime().optional(),
});

export const ReceivePOLinesSchema = z.object({
  receivedLines: z.array(ReceivePOLineSchema).min(1, 'At least one line must be received'),
});

export const UpdatePOStatusSchema = z.object({
  status: z.nativeEnum(POStatusEnum, { error: 'Invalid status' }),
});

export type CreatePOInput = z.infer<typeof CreatePOSchema>;
export type UpdatePOInput = z.infer<typeof UpdatePOSchema>;
export type PayPurchaseOrderInput = z.infer<typeof PayPurchaseOrderSchema>;
export type ReceivePOLinesInput = z.infer<typeof ReceivePOLinesSchema>;
export type UpdatePOStatusInput = z.infer<typeof UpdatePOStatusSchema>;
