import { ApiError } from '@/lib/api/errors';
import type { SaleStatus } from '@/generated/prisma/client';

/**
 * Guard a sale before voiding it.
 *
 * A sale with completed returns cannot be voided: the return already restocked
 * the returned units and refunded their value, so a full void would restore
 * them twice and reverse money that was already paid back (ARGUS #94). Such
 * sales must be corrected through the return/refund flow instead.
 */
export function assertSaleVoidable(input: {
  status: SaleStatus;
  completedReturnCount: number;
}): void {
  if (input.status !== 'COMPLETED') {
    throw new Error('Only completed sales can be voided');
  }
  if (input.completedReturnCount > 0) {
    throw new ApiError(
      409,
      'SALE_HAS_RETURNS',
      'This sale has completed returns and cannot be voided - process a correction through the return flow instead',
    );
  }
}
