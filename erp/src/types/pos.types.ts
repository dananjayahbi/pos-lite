import type Decimal from 'decimal.js';

/** Payload assembled from the cart, ready to be sent minus payment-specific fields */
export interface CreateSalePayload {
  shiftId: string;
  lines: Array<{
    variantId: string;
    quantity: number;
    discountPercent: number;
  }>;
  cartDiscountAmount: number;
  authorizingManagerId?: string;
  customerId?: string | undefined;
  appliedStoreCredit?: string | undefined;
  appliedPromotions?: unknown | undefined;
  promoCode?: string | undefined;
}

/** Sale object returned by POST /api/store/sales on success */
export interface CompletedSale {
  id: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  completedAt: string;
  changeGiven?: number | null;
  [key: string]: unknown;
}

/** Props shared across all payment modals */
export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSaleComplete: (sale: CompletedSale) => void;
  totalAmount: Decimal;
  salePayload: CreateSalePayload;
}
