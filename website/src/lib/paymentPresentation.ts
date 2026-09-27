import type { OrderPaymentStatus } from '@/lib/api/orderPayment';

/**
 * Presentation mapping for an order payment status — one place that decides the
 * icon, colours and headline for every payment outcome, so the return page, the
 * confirmation screen and any future order view stay consistent.
 */

export type PaymentTone = 'success' | 'pending' | 'failure' | 'neutral';

export interface PaymentPresentation {
  tone: PaymentTone;
  /** Short headline for the outcome. */
  title: string;
  /** One supporting sentence. */
  description: string;
}

export function presentPaymentStatus(
  status: OrderPaymentStatus,
  options: { wasCancelled: boolean; paymentMethod: string },
): PaymentPresentation {
  // The customer came back via PayHere's cancel_url. Nothing is charged, and
  // the order itself still exists — say so instead of implying a failure.
  if (options.wasCancelled && status === 'PENDING') {
    return {
      tone: 'neutral',
      title: 'Payment cancelled',
      description:
        'Your order has been saved but is not paid yet. You can complete the payment on your next visit, or contact us to switch to cash on delivery.',
    };
  }

  switch (status) {
    case 'PAID':
      return {
        tone: 'success',
        title: 'Payment successful',
        description:
          'We have received your payment and your order is being prepared for dispatch.',
      };
    case 'FAILED':
      return {
        tone: 'failure',
        title: 'Payment was not completed',
        description:
          'Your card was not charged. You can place the order again, or contact us to arrange cash on delivery.',
      };
    case 'REFUNDED':
      return {
        tone: 'neutral',
        title: 'Payment refunded',
        description:
          'This payment has been refunded. Refunds can take a few banking days to appear on your statement.',
      };
    default:
      // Still PENDING: the customer has just been redirected back and PayHere's
      // server callback may not have landed yet.
      return options.paymentMethod === 'CARD'
        ? {
            tone: 'pending',
            title: 'Confirming your payment',
            description:
              'We are waiting for the card network to confirm your payment. This page refreshes automatically — no action is needed.',
          }
        : {
            tone: 'neutral',
            title: 'Order placed',
            description: 'Pay in cash when your order arrives.',
          };
  }
}

/** Whether a status is worth continuing to poll for. */
export function isPaymentSettled(status: OrderPaymentStatus): boolean {
  return status === 'PAID' || status === 'FAILED' || status === 'REFUNDED';
}
