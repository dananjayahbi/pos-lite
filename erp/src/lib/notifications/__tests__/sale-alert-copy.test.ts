import { describe, expect, it } from 'vitest';

import {
  SALE_COMPLETED_TITLE,
  SALE_VOIDED_TITLE,
  buildSaleCompletedCopy,
  buildSaleVoidedCopy,
  isVoidedSaleAlert,
  saleShortId,
  zeroValueReasonLabel,
} from '@/lib/notifications/sale-alert-copy';

/** ARGUS #52: sale alerts must clearly identify a voided sale. */
describe('sale alert void copy', () => {
  it('builds the same short id the producer uses', () => {
    expect(saleShortId('abcdef123456')).toBe('ABCDEF12');
  });

  it('labels a void and states the reversed amount', () => {
    const copy = buildSaleVoidedCopy('abcdef123456', '1250.5');
    expect(copy.title).toBe(SALE_VOIDED_TITLE);
    expect(copy.body).toBe('Sale #ABCDEF12 was voided. Rs. 1,250.50 reversed.');
  });

  it('formats a numeric amount and tolerates a non-numeric one', () => {
    expect(buildSaleVoidedCopy('sale', 99.999).body).toContain('Rs. 100.00 reversed.');
    expect(buildSaleVoidedCopy('sale', 'not-a-number').body).toContain('Rs. 0.00 reversed.');
  });

  it('puts the minus before the currency for a negative amount', () => {
    expect(buildSaleVoidedCopy('sale', -1156.7).body).toContain('-Rs. 1,156.70 reversed.');
  });

  it('only marks SALE_COMPLETED alerts whose linked sale is VOIDED', () => {
    expect(isVoidedSaleAlert('SALE_COMPLETED', { status: 'VOIDED', totalAmount: 10 })).toBe(true);
    expect(isVoidedSaleAlert('SALE_COMPLETED', { status: 'COMPLETED', totalAmount: 10 })).toBe(false);
    expect(isVoidedSaleAlert('SALE_COMPLETED', null)).toBe(false);
    expect(isVoidedSaleAlert('RETURN_PROCESSED', { status: 'VOIDED', totalAmount: 10 })).toBe(false);
  });
});

/** ARGUS #53: a completed alert must show the sale's final total. */
describe('sale alert completed copy', () => {
  it('rebuilds the alert with the current total (delivery included)', () => {
    const copy = buildSaleCompletedCopy('abcdef123456', '1891.76');
    expect(copy.title).toBe(SALE_COMPLETED_TITLE);
    expect(copy.body).toBe('Sale #ABCDEF12 completed for Rs. 1,891.76.');
  });

  it('formats amounts consistently', () => {
    expect(buildSaleCompletedCopy('sale', 1641.759).body).toContain('Rs. 1,641.76.');
    expect(buildSaleCompletedCopy('sale', 'nope').body).toContain('Rs. 0.00.');
  });

  it('groups thousands and leads with the minus sign', () => {
    expect(buildSaleCompletedCopy('sale', 2476.58).body).toContain('Rs. 2,476.58.');
    expect(buildSaleCompletedCopy('sale', '-1156.70').body).toContain('-Rs. 1,156.70.');
  });
});

/** ARGUS #58: a zero-value alert must say why the total was zero. */
describe('sale alert zero-value reason', () => {
  it('labels the persisted zero-value reasons', () => {
    expect(zeroValueReasonLabel('BANK_PAYMENT')).toBe('Bank payment');
    expect(zeroValueReasonLabel('PRODUCT_REPLACEMENT')).toBe('Replacement');
    expect(zeroValueReasonLabel('COMPLIMENTARY_GIFT')).toBe('Complimentary');
    expect(zeroValueReasonLabel(null)).toBeNull();
    expect(zeroValueReasonLabel('SOMETHING_ELSE')).toBeNull();
  });

  it('appends the reason to a zero-total completed alert', () => {
    expect(
      buildSaleCompletedCopy('sale', 0, { zeroValueReason: 'BANK_PAYMENT' }).body,
    ).toBe('Sale #SALE completed for Rs. 0.00. Reason: Bank payment.');
    expect(
      buildSaleCompletedCopy('sale', 0, { zeroValueReason: 'PRODUCT_REPLACEMENT' }).body,
    ).toContain('Reason: Replacement.');
    expect(
      buildSaleCompletedCopy('sale', 0, { zeroValueReason: 'COMPLIMENTARY_GIFT' }).body,
    ).toContain('Reason: Complimentary.');
  });

  it('says the reason was not recorded instead of guessing', () => {
    expect(buildSaleCompletedCopy('sale', 0).body).toBe(
      'Sale #SALE completed for Rs. 0.00. Reason: not recorded.',
    );
  });

  it('does not add a reason to a paid sale', () => {
    expect(
      buildSaleCompletedCopy('sale', 500, { zeroValueReason: 'BANK_PAYMENT' }).body,
    ).toBe('Sale #SALE completed for Rs. 500.00.');
  });
});
