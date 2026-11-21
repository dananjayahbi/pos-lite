import { describe, expect, it } from 'vitest';

import {
  collectedTenderMethods,
  defaultRefundMethodForSale,
  isTenderCompatibleRefundMethod,
  refundMethodTenderMismatchReason,
} from '@/lib/services/returnTender.core';

/**
 * ARGUS #96 — a refund may only leave through the tender the sale took.
 */

describe('collectedTenderMethods', () => {
  it('prefers the persisted payment legs', () => {
    const tenders = collectedTenderMethods({
      paymentMethod: 'SPLIT',
      payments: [{ method: 'CASH' }, { method: 'LANKAQR' }],
    });

    expect([...tenders].sort()).toEqual(['CASH', 'LANKAQR']);
  });

  it('falls back to the sale header for legacy rows without legs', () => {
    expect([...collectedTenderMethods({ paymentMethod: 'CASH' })]).toEqual(['CASH']);
    expect([...collectedTenderMethods({ paymentMethod: 'CARD' })]).toEqual(['CARD']);
    expect([...collectedTenderMethods({ paymentMethod: 'LANKAQR' })]).toEqual(['LANKAQR']);
    expect([...collectedTenderMethods({ paymentMethod: 'SPLIT' })]).toEqual(['CASH', 'CARD']);
    expect([...collectedTenderMethods({ paymentMethod: 'STORE_CREDIT' })]).toEqual(['STORE_CREDIT']);
    expect([...collectedTenderMethods({ paymentMethod: 'NONE' })]).toEqual([]);
    expect([...collectedTenderMethods(null)]).toEqual([]);
  });
});

describe('isTenderCompatibleRefundMethod', () => {
  const cashSale = { paymentMethod: 'CASH' as const };
  const cardSale = { paymentMethod: 'CARD' as const };
  const qrSale = { paymentMethod: 'LANKAQR' as const };
  const splitSale = {
    paymentMethod: 'SPLIT' as const,
    payments: [{ method: 'CASH' as const }, { method: 'CARD' as const }],
  };

  it('rejects a card reversal against a cash-only sale', () => {
    expect(isTenderCompatibleRefundMethod('CARD_REVERSAL', cashSale)).toBe(false);
    expect(refundMethodTenderMismatchReason('CARD_REVERSAL', cashSale)).toContain('card or QR');
  });

  it('rejects a cash refund when no cash was collected', () => {
    expect(isTenderCompatibleRefundMethod('CASH', cardSale)).toBe(false);
    expect(isTenderCompatibleRefundMethod('CASH', qrSale)).toBe(false);
    expect(refundMethodTenderMismatchReason('CASH', cardSale)).toContain('no cash');
  });

  it('allows the digital tender on card and QR sales', () => {
    expect(isTenderCompatibleRefundMethod('CARD_REVERSAL', cardSale)).toBe(true);
    expect(isTenderCompatibleRefundMethod('CARD_REVERSAL', qrSale)).toBe(true);
  });

  it('allows both refund tenders on a split sale', () => {
    expect(isTenderCompatibleRefundMethod('CASH', splitSale)).toBe(true);
    expect(isTenderCompatibleRefundMethod('CARD_REVERSAL', splitSale)).toBe(true);
  });

  it('keeps store credit and exchange available on every sale', () => {
    for (const sale of [cashSale, cardSale, qrSale, splitSale, null]) {
      expect(isTenderCompatibleRefundMethod('STORE_CREDIT', sale)).toBe(true);
      expect(isTenderCompatibleRefundMethod('EXCHANGE', sale)).toBe(true);
    }
  });
});

describe('defaultRefundMethodForSale', () => {
  it('defaults to cash for a cash sale', () => {
    expect(
      defaultRefundMethodForSale({ paymentMethod: 'CASH' }, { storeCreditAvailable: false }),
    ).toBe('CASH');
  });

  it('defaults to card reversal for a card sale', () => {
    expect(
      defaultRefundMethodForSale({ paymentMethod: 'CARD' }, { storeCreditAvailable: true }),
    ).toBe('CARD_REVERSAL');
  });

  it('skips store credit when the sale has no customer', () => {
    expect(
      defaultRefundMethodForSale({ paymentMethod: 'STORE_CREDIT' }, { storeCreditAvailable: false }),
    ).toBe('EXCHANGE');
  });

  it('defaults to store credit for a store-credit sale with a customer', () => {
    expect(
      defaultRefundMethodForSale({ paymentMethod: 'STORE_CREDIT' }, { storeCreditAvailable: true }),
    ).toBe('STORE_CREDIT');
  });
});
