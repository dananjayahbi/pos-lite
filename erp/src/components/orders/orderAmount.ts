/**
 * ARGUS #266 - Dispatch Orders must show how an order is paid and what the
 * courier actually collects. A prepaid card order and a zero-value manual COD
 * order both showed "Rs. 0.00" and no source, so they looked identical.
 */
import Decimal from 'decimal.js';

import { collectableCodAmount, isPrepaidOrder } from '@/lib/delivery/cod';
import type { DeliverySource } from '@/generated/prisma/client';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface OrderAmountFields {
  codAmount?: Decimalish | null;
  shippingFee?: Decimalish | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  declaredValue?: Decimalish | null;
}

export interface OrderAmountSummary {
  /** Payment already collected at checkout; the courier collects nothing. */
  isPrepaid: boolean;
  /** Goods value stored on the delivery (the old "COD" figure). */
  goodsAmount: Decimal;
  /** Delivery fee charged to the customer. */
  shippingFee: Decimal;
  /** Goods + shipping for unpaid orders, zero for prepaid orders. */
  totalToCollect: Decimal;
  declaredValue: Decimal | null;
}

function toDecimal(value: Decimalish | null | undefined): Decimal {
  return new Decimal(value?.toString() ?? '0');
}

export function orderAmountSummary(order: OrderAmountFields): OrderAmountSummary {
  const goodsAmount = toDecimal(order.codAmount);
  const shippingFee = toDecimal(order.shippingFee);
  return {
    isPrepaid: isPrepaidOrder(order),
    goodsAmount,
    shippingFee,
    // Single courier-facing rule (ARGUS #288): goods + shipping, or 0 if paid.
    totalToCollect: collectableCodAmount(order),
    declaredValue:
      order.declaredValue === null || order.declaredValue === undefined
        ? null
        : toDecimal(order.declaredValue),
  };
}

/** The amount the courier should collect for one order. */
export function totalToCollect(order: OrderAmountFields): Decimal {
  return orderAmountSummary(order).totalToCollect;
}

export function deliverySourceLabel(source: DeliverySource | string | null | undefined): string {
  switch (source) {
    case 'WEBSITE_CHECKOUT':
      return 'Website';
    case 'ERP_MANUAL':
      return 'Manual';
    case 'POS':
      return 'POS';
    case 'IMPORT':
      return 'Import';
    default:
      return '-';
  }
}

export function paymentMethodLabel(paymentMethod: string | null | undefined): string {
  switch (paymentMethod) {
    case 'COD':
      return 'COD';
    case 'CARD':
      return 'Card';
    case null:
    case undefined:
    case '':
      return 'No method';
    default:
      return paymentMethod;
  }
}

export function paymentStatusLabel(paymentStatus: string | null | undefined): string {
  switch (paymentStatus) {
    case 'PAID':
      return 'Paid';
    case 'PENDING':
      return 'Pending';
    case 'FAILED':
      return 'Failed';
    case 'REFUNDED':
      return 'Refunded';
    case null:
    case undefined:
    case '':
      return 'Unknown';
    default:
      return paymentStatus;
  }
}
