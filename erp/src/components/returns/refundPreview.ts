import {
  computeReturnRefund,
  type RefundRequestLine,
  type RefundSaleForPricing,
} from '@/lib/services/returnRefund.core';

/**
 * ARGUS #99 — refund preview shown before a management return is submitted.
 *
 * Wraps the exact pure calculation the return service uses, so the preview's
 * line refunds, tax share and total match what will be persisted. Purely
 * informational: the server still recomputes and stores the authoritative
 * amount.
 */

export interface ReturnRefundPreviewLine {
  saleLineId: string;
  quantity: number;
  /** Goods part, after the sale's cart discount. */
  goodsRefund: string;
  taxRefund: string;
  lineRefundAmount: string;
}

export interface ReturnRefundPreview {
  lines: ReturnRefundPreviewLine[];
  goodsSubtotal: string;
  taxTotal: string;
  totalRefund: string;
}

export function buildReturnRefundPreview(
  sale: RefundSaleForPricing,
  selectedLines: readonly RefundRequestLine[],
): ReturnRefundPreview {
  const computed = computeReturnRefund(
    sale,
    selectedLines.map((line) => ({
      saleLineId: line.saleLineId,
      quantity: line.quantity,
    })),
  );

  return {
    lines: computed.lines.map((line) => ({
      saleLineId: line.saleLineId,
      quantity: line.quantity,
      goodsRefund: line.goodsRefund.toFixed(2),
      taxRefund: line.taxRefund.toFixed(2),
      lineRefundAmount: line.lineRefundAmount.toFixed(2),
    })),
    goodsSubtotal: computed.totalRefund.minus(computed.totalTaxRefund).toFixed(2),
    taxTotal: computed.totalTaxRefund.toFixed(2),
    totalRefund: computed.totalRefund.toFixed(2),
  };
}
