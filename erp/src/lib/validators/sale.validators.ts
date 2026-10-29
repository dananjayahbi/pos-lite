import { z } from 'zod';
import { PaymentMethod, ZeroValueReason } from '@/generated/prisma/client';

const CreateSaleLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.int().min(1),
  discountPercent: z.number().min(0).max(100).default(0),
});

/**
 * Backdated sales are a management/back-office capability, so the window is
 * deliberately generous (10 years back covers any plausible missed entry) but
 * bounded — a typo like `0202-01-01` must not silently become a sale.
 */
const MAX_BACKDATE_YEARS = 10;
/** Allow "today" from any timezone, nothing further ahead. */
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export function parseSaleDate(raw: string): Date | null {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Shared shape for the editable sale date. Accepts an ISO string or a
 * `yyyy-mm-dd` value from `<input type="date">` (both parse through `Date`)
 * and always yields a `Date`, so callers never persist a string.
 */
export const SaleDateSchema = z
  .union([z.string().min(1), z.date()])
  .superRefine((value, ctx) => {
    const parsed = value instanceof Date ? value : parseSaleDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'saleDate must be a valid date' });
      return;
    }
    if (parsed.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      ctx.addIssue({ code: 'custom', message: 'saleDate cannot be in the future' });
      return;
    }
    if (parsed.getTime() < Date.now() - MAX_BACKDATE_YEARS * 365 * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: 'custom',
        message: `saleDate cannot be more than ${MAX_BACKDATE_YEARS} years in the past`,
      });
    }
  })
  // Only reached when the checks above passed, so the value is a valid Date.
  .transform((value) => (value instanceof Date ? value : parseSaleDate(value)) as Date);

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
    // Walk-in mode: a POS sale may be completed with no customer identity at
    // all ("just put the bill"). Only meaningful when customerId is absent.
    isGuestSale: z.boolean().optional(),
    appliedStoreCredit: z.string().optional().default('0'),
    appliedPromotions: z.any().optional(),
    promoCode: z.string().max(50).optional(),
    // Backdated / missed-entry sales carry their own accounting date.
    saleDate: SaleDateSchema.optional(),
    // Delivery charge is folded into the sale total; it is optional so the POS
    // terminal (which never sends it) keeps producing identical totals.
    deliveryCharge: z.number().min(0).default(0),
    // Which payment account the collected money lands in. Optional: when it is
    // absent the service resolves a per-tenant default for the tender method,
    // and when the tenant has no accounts at all the ledger entry is skipped
    // so accounting can never block a sale.
    paymentAccountId: z.string().min(1).optional(),
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
    // POS sales must be linked to a customer, UNLESS the operator explicitly
    // recorded a walk-in/guest sale (`isGuestSale: true`). Shiftless sales are
    // created from the owner/manager sales page, where a customer may be
    // intentionally omitted.
    if (data.shiftId && !data.customerId && !data.isGuestSale) {
      ctx.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'A customer must be linked to finalize a POS sale',
      });
    }
    // Store credit is customer-scoped: a guest sale must never redeem it.
    if (data.isGuestSale && !data.customerId) {
      const credit = Number.parseFloat(data.appliedStoreCredit ?? '0');
      if (Number.isFinite(credit) && credit > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['appliedStoreCredit'],
          message: 'Store credit cannot be applied to a guest sale — link a customer first',
        });
      }
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

// ── Update Sale (amend mutable details only) ─────────────────────────────────

/**
 * Only financially-inert fields are amendable after a sale is COMPLETED.
 * Line items, prices, discounts and payment legs are immutable by design —
 * corrections to those go through returns/voids, which restore stock and
 * produce an audit trail.
 */
export const UpdateSaleSchema = z
  .object({
    // `null` explicitly means "make this a walk-in/guest sale".
    customerId: z.string().min(1).nullable().optional(),
    // `null` clears an override and falls back to the stored sale date.
    saleDate: SaleDateSchema.nullable().optional(),
    deliveryCharge: z.number().min(0).max(1_000_000).optional(),
  })
  .refine(
    (data) =>
      data.customerId !== undefined ||
      data.saleDate !== undefined ||
      data.deliveryCharge !== undefined,
    { error: 'At least one of customerId, saleDate or deliveryCharge must be provided' },
  );

export type UpdateSaleInput = z.infer<typeof UpdateSaleSchema>;

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
