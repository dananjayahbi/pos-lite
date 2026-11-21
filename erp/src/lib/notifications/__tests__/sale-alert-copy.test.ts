import { describe, expect, it } from 'vitest';

import {
  SALE_VOIDED_TITLE,
  buildSaleVoidedCopy,
  isVoidedSaleAlert,
  saleShortId,
} from '@/lib/notifications/sale-alert-copy';

/** ARGUS #52: sale alerts must clearly identify a voided sale. */
describe('sale alert void copy', () => {
  it('builds the same short id the producer uses', () => {
    expect(saleShortId('abcdef123456')).toBe('ABCDEF12');
  });

  it('labels a void and states the reversed amount', () => {
    const copy = buildSaleVoidedCopy('abcdef123456', '1250.5');
    expect(copy.title).toBe(SALE_VOIDED_TITLE);
    expect(copy.body).toBe('Sale #ABCDEF12 was voided. Rs. 1250.50 reversed.');
  });

  it('formats a numeric amount and tolerates a non-numeric one', () => {
    expect(buildSaleVoidedCopy('sale', 99.999).body).toContain('Rs. 100.00 reversed.');
    expect(buildSaleVoidedCopy('sale', 'not-a-number').body).toContain('Rs. 0.00 reversed.');
  });

  it('only marks SALE_COMPLETED alerts whose linked sale is VOIDED', () => {
    expect(isVoidedSaleAlert('SALE_COMPLETED', { status: 'VOIDED', totalAmount: 10 })).toBe(true);
    expect(isVoidedSaleAlert('SALE_COMPLETED', { status: 'COMPLETED', totalAmount: 10 })).toBe(false);
    expect(isVoidedSaleAlert('SALE_COMPLETED', null)).toBe(false);
    expect(isVoidedSaleAlert('RETURN_PROCESSED', { status: 'VOIDED', totalAmount: 10 })).toBe(false);
  });
});
