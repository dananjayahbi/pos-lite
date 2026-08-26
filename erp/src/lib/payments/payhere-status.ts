import { OrderPaymentStatus } from '@/generated/prisma/client';

/**
 * Map a PayHere IPN status code to our order payment status. Kept in a small,
 * dependency-free module so it can be unit-tested without a DB.
 */
export function mapOrderPayhereStatus(statusCode: number): OrderPaymentStatus {
  switch (statusCode) {
    case 2:
      return OrderPaymentStatus.PAID;
    case 0:
    case -2:
      return OrderPaymentStatus.FAILED;
    case -3:
      return OrderPaymentStatus.REFUNDED;
    default:
      return OrderPaymentStatus.FAILED;
  }
}
