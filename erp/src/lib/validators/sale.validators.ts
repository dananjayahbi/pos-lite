import { z } from 'zod';
import { PaymentMethod, ZeroValueReason } from '@/generated/prisma/client';

const CreateSaleLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.int().min(1),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const CreateSaleSchema = z
  .object({
    shiftId: z.string().min(1).optional(),
    lines: z.array(CreateSaleLineSchema).min(1),
    cartDiscountAmount: z.number().min(0).default(0),
    paymentMethod: z.nativeEnum(PaymentMethod, { error: 'Invalid payment method' }),
    authorizingManagerId: z.string().min(1).optional(),
    cashReceived: z.number().positive().optional(),
    cardReferenceNumber: z.string().max(20).optional(),
    cardAmount: z.number().positive().optional(),
    splitLegMethod: z.enum(['CARD', 'LANKAQR']).optional(),
    customerId: z.string().min(1).optional(),
    appliedStoreCredit: z.string().optional().default('0'),
    appliedPromotions: z.any().optional(),
    promoCode: z.string().max(50).optional(),
    // Doc 33 / 34: zero-value reason + original order reference for replacements.
    zeroValueReason: z.nativeEnum(ZeroValueReason).optional(),
    zeroValueLinkedOrderRef: z.string().trim().min(1).max(64).optional(),
    // M14-04 (req 3.11 / D14): scanned barcode of the defective item; required
    // by the superRefine below when reason = PRODUCT_REPLACEMENT, and resolved
    // against the tenant's variant barcodes in the service before persisting.
    defectiveBarcode: z.string().trim().max(64).optional(),
  })
  .superRefine((data, ctx) => {
    // M14-01 (BUG-44): NONE is not a client-selectable tender. Zero-value sales
    // are expressed by a computed total of 0 (+ zeroValueReason) and the
    // service records paymentMethod='NONE' internally; a client that sends NONE
    // alongside a reason is tolerated (the zero-value path), but NONE without a
    // zeroValueReason is always rejected here — the service adds a total-aware
    // guard for internal callers that bypass the validator.
    if (data.paymentMethod === 'NONE' && !data.zeroValueReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'A non-zero sale requires CASH/CARD/SPLIT/LANKAQR — NONE is reserved for zero-value sales with a reason',
      });
    }
    if (data.paymentMethod === 'CASH') {
      if (data.cashReceived === undefined || data.cashReceived <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cashReceived'],
          message: 'cashReceived is required for CASH payments',
        });
      }
    }
    if (data.paymentMethod === 'SPLIT') {
      if (data.cardAmount === undefined || data.cardAmount <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cardAmount'],
          message: 'cardAmount is required for SPLIT payments',
        });
      }
      if (data.cashReceived === undefined || data.cashReceived <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cashReceived'],
          message: 'cashReceived is required for SPLIT payments',
        });
      }
    }
    // POS sales must be linked to a customer. Shiftless sales are created from
    // the owner/manager sales page, where a customer may be intentionally omitted.
    if (data.shiftId && !data.customerId) {
      ctx.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'A customer must be linked to finalize a POS sale',
      });
    }
    // Doc 34: a replacement must point at an original order reference.
    // M14-04 (req 3.11 / D14 = BOTH): and must carry the defective item barcode.
    if (data.zeroValueReason === 'PRODUCT_REPLACEMENT') {
      if (!data.zeroValueLinkedOrderRef || data.zeroValueLinkedOrderRef.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['zeroValueLinkedOrderRef'],
          message: 'An original order reference is required for PRODUCT_REPLACEMENT sales',
        });
      }
      if (!data.defectiveBarcode || data.defectiveBarcode.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['defectiveBarcode'],
          message: 'The defective item barcode is required for PRODUCT_REPLACEMENT sales',
        });
      }
    }
  });

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

// ── Hold Sale ────────────────────────────────────────────────────────────────

const HoldSaleLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.int().min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  productNameSnapshot: z.string().min(1),
  variantDescriptionSnapshot: z.string().min(1),
  sku: z.string().min(1),
  unitPrice: z.number().min(0),
});

export const HoldSaleSchema = z.object({
  saleId: z.string().optional(),
  shiftId: z.string().min(1),
  lines: z.array(HoldSaleLineSchema).min(1),
  cartDiscountAmount: z.number().min(0).default(0),
  cartDiscountPercent: z.number().min(0).max(100).default(0),
});

export type HoldSaleInput = z.infer<typeof HoldSaleSchema>;
