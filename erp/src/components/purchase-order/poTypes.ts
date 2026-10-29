/**
 * Wire shapes for the purchase-order API.
 *
 * Prisma `Decimal` columns arrive as strings and `DateTime` columns as ISO
 * strings, so money/date fields are typed loosely and formatted at render time.
 */

export type PODiscountType = 'PERCENTAGE' | 'FIXED';

/** One editable row in the create form, before it becomes an API line. */
export interface POLineDraft {
  /** Stable React key; never sent to the server. */
  key: string;
  variantId: string;
  /** Human label for the summary panel. */
  label: string;
  orderedQty: number;
  expectedCostPrice: number;
}

export interface POLine {
  id: string;
  variantId: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  orderedQty: number;
  receivedQty: number;
  isFullyReceived: boolean;
  expectedCostPrice: string | number;
  actualCostPrice?: string | number | null;
  variant: {
    sku: string;
    form?: string | null;
    packSize?: string | null;
    product?: { name: string } | null;
  };
}

export interface PurchaseOrderDetail {
  id: string;
  referenceNo: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  subtotalAmount: string | number;
  discountType: PODiscountType | null;
  discountValue: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paymentTermDays: number | null;
  paymentAccountId: string | null;
  paidAt: string | null;
  createdAt: string;
  /** Server-computed: false once any line has been received. */
  linesEditable?: boolean;
  supplier: {
    id: string;
    name: string;
    phone?: string | null;
    whatsappNumber?: string | null;
    contactName?: string | null;
  };
  createdBy: { id: string; email: string };
  lines: POLine[];
}

export interface PurchaseOrderListItem {
  id: string;
  referenceNo: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  subtotalAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paidAt: string | null;
  createdAt: string;
  supplier: { name: string };
  _count: { lines: number };
}

export interface PurchaseOrderListResponse {
  purchaseOrders: PurchaseOrderListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface POPayment {
  id: string;
  amount: string | number;
  paidAt: string;
  reference?: string | null;
  note?: string | null;
  paymentAccountId: string;
  account: { id: string; name: string; type: string } | null;
}

export interface POPaymentsResponse {
  payments: POPayment[];
  paidTotal: number;
}

export interface PaymentAccountOption {
  id: string;
  name: string;
  type: string;
  status: string;
  balance: string | number;
}

export interface PaymentAccountListResponse {
  accounts: PaymentAccountOption[];
  totalBalance: number;
}

/** Payload accepted by `PATCH /api/store/purchase-orders/:id`. */
export interface UpdatePurchaseOrderPayload {
  referenceNo?: string | undefined;
  orderDate?: string | undefined;
  expectedDeliveryDate?: string | null | undefined;
  notes?: string | null | undefined;
  discountType?: PODiscountType | null | undefined;
  discountValue?: number | undefined;
  paymentTermDays?: number | null | undefined;
  paymentAccountId?: string | null | undefined;
  lines?: Array<{ variantId: string; orderedQty: number; expectedCostPrice: number }> | undefined;
}

/** Payload accepted by `POST /api/store/purchase-orders/:id/payments`. */
export interface RecordPaymentPayload {
  paymentAccountId: string;
  amount: number;
  paidAt?: string;
  reference?: string;
  note?: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  amount: number;
  paidTotal: number;
  payable: number;
  outstanding: number;
  settled: boolean;
}
