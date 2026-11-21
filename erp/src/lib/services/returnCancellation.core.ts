/**
 * Guard rules for reversing a completed return (ARGUS #102).
 *
 * Kept pure so the API/service and tests agree on when a reversal is safe.
 */
export interface ReturnCancellationInput {
  status: string;
  reason: string;
  linkedSaleCount: number;
  refundMethod: string;
  refundAmount: number;
  customerId: string | null;
  customerCreditBalance?: number | undefined;
}

export interface ReturnCancellationError {
  code: string;
  message: string;
}

export function validateReturnCancellation(
  input: ReturnCancellationInput,
): ReturnCancellationError | null {
  if (input.reason.trim().length < 5) {
    return {
      code: 'RETURN_CANCEL_REASON_REQUIRED',
      message: 'A reason of at least 5 characters is required to reverse a return',
    };
  }
  if (input.status !== 'COMPLETED') {
    return {
      code: 'RETURN_NOT_CANCELLABLE',
      message: 'Only a completed return can be reversed',
    };
  }
  if (input.linkedSaleCount > 0) {
    return {
      code: 'RETURN_ALREADY_EXCHANGED',
      message: 'The exchange credit from this return has already been used on another sale',
    };
  }
  if (input.refundMethod === 'STORE_CREDIT') {
    if (!input.customerId) {
      return {
        code: 'RETURN_STORE_CREDIT_NO_CUSTOMER',
        message: 'This return has no customer to recover credit from',
      };
    }
    if ((input.customerCreditBalance ?? 0) < input.refundAmount) {
      return {
        code: 'RETURN_CREDIT_ALREADY_SPENT',
        message:
          'The customer has already spent this store credit - adjust the balance manually or reverse the later sale first',
      };
    }
  }
  return null;
}
