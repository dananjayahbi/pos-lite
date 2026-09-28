import { describe, expect, it } from 'vitest';
import {
  isPaymentSettled,
  presentPaymentStatus,
} from '@/lib/paymentPresentation';

/**
 * The return page must never claim more than the database knows. PayHere's
 * `return_url` carries no status, and a cancellation is NOT a failure (the
 * customer may have paid in another tab), so these tests pin the wording rules
 * for every outcome.
 */
describe('presentPaymentStatus', () => {
  const card = { wasCancelled: false, paymentMethod: 'CARD' };

  it('reports success only for PAID', () => {
    expect(presentPaymentStatus('PAID', card).tone).toBe('success');
    expect(presentPaymentStatus('PAID', card).title).toMatch(/successful/i);
  });

  it('treats an unresolved CARD payment as pending, never as paid', () => {
    const result = presentPaymentStatus('PENDING', card);
    expect(result.tone).toBe('pending');
    expect(result.title).not.toMatch(/success|thank/i);
  });

  it('reports failure for FAILED and refund for REFUNDED', () => {
    expect(presentPaymentStatus('FAILED', card).tone).toBe('failure');
    expect(presentPaymentStatus('REFUNDED', card).tone).toBe('neutral');
  });

  it('describes a cancellation neutrally and says the order still exists', () => {
    const result = presentPaymentStatus('PENDING', {
      wasCancelled: true,
      paymentMethod: 'CARD',
    });
    expect(result.tone).toBe('neutral');
    expect(result.title).toMatch(/cancelled/i);
    expect(result.description).toMatch(/saved/i);
  });

  it('does NOT let the cancelled flag override a real failure', () => {
    // The query flag is a UI hint only; the database decides the outcome.
    expect(
      presentPaymentStatus('FAILED', { wasCancelled: true, paymentMethod: 'CARD' }).tone,
    ).toBe('failure');
  });

  it('does NOT let the cancelled flag hide a genuine success', () => {
    // A customer who pays and then navigates back can arrive with cancelled=1.
    expect(
      presentPaymentStatus('PAID', { wasCancelled: true, paymentMethod: 'CARD' }).tone,
    ).toBe('success');
  });

  it('describes a COD order as payable on delivery', () => {
    const result = presentPaymentStatus('PENDING', {
      wasCancelled: false,
      paymentMethod: 'COD',
    });
    expect(result.tone).toBe('neutral');
    expect(result.description).toMatch(/cash/i);
  });
});

describe('isPaymentSettled', () => {
  it('is true only for terminal states', () => {
    expect(isPaymentSettled('PAID')).toBe(true);
    expect(isPaymentSettled('FAILED')).toBe(true);
    expect(isPaymentSettled('REFUNDED')).toBe(true);
  });

  it('is false while the gateway has not answered yet', () => {
    expect(isPaymentSettled('PENDING')).toBe(false);
  });
});
