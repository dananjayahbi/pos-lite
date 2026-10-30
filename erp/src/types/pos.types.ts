import type Decimal from 'decimal.js';

/** Payload assembled from the cart, ready to be sent minus payment-specific fields */
export interface CreateSalePayload {
  shiftId?: string;
  lines: Array<{
    variantId: string;
    quantity: number;
    discountPercent: number;
  }>;
  cartDiscountAmount: number;
  authorizingManagerId?: string;
  customerId?: string | undefined;
  /**
   * Guest mode: the sale is attributed to no customer. The POS defaults to
   * this so a cashier can bill an anonymous walk-in without capturing any
   * details; sending `customerId` (or creating one inline) switches the sale
   * to an attributed sale instead.
   */
  isGuestSale?: boolean | undefined;
  splitLegMethod?: 'CARD' | 'LANKAQR' | undefined;
  appliedStoreCredit?: string | undefined;
  appliedPromotions?: unknown | undefined;
  promoCode?: string | undefined;
  // Doc 33 / 34: zero-value reason + linked original order reference.
  zeroValueReason?: 'BANK_PAYMENT' | 'PRODUCT_REPLACEMENT' | 'COMPLIMENTARY_GIFT' | undefined;
  zeroValueLinkedOrderRef?: string | undefined;
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
