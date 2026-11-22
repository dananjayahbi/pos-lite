import { describe, expect, it } from 'vitest';

import {
  PAYMENT_METHOD_VALUES,
  SALE_STATUS_VALUES,
  parseSalePaymentMethod,
  parseSaleStatus,
} from '@/lib/sales/sale-list-filters';

/** ARGUS #79 — invalid list filters are a typed 400, not a 500. */
describe('parseSaleStatus', () => {
  it('accepts every valid status', () => {
    for (const status of SALE_STATUS_VALUES) {
      expect(parseSaleStatus(status)).toEqual({ ok: true, value: status });
    }
  });

  it('treats blank/absent as no filter', () => {
    expect(parseSaleStatus(null)).toEqual({ ok: true, value: undefined });
    expect(parseSaleStatus(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseSaleStatus('')).toEqual({ ok: true, value: undefined });
    expect(parseSaleStatus('   ')).toEqual({ ok: true, value: undefined });
  });

  it('rejects an unknown status and names the parameter', () => {
    const result = parseSaleStatus('NOT_A_STATUS');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.param).toBe('status');
      expect(result.message).toContain('status');
      expect(result.message).toContain('NOT_A_STATUS');
      expect(result.message).toContain('OPEN');
    }
  });

  it('is case-sensitive (enums are uppercase)', () => {
    expect(parseSaleStatus('open').ok).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(parseSaleStatus('  OPEN  ')).toEqual({ ok: true, value: 'OPEN' });
  });
});

describe('parseSalePaymentMethod', () => {
  it('accepts every valid payment method', () => {
    for (const method of PAYMENT_METHOD_VALUES) {
      expect(parseSalePaymentMethod(method)).toEqual({ ok: true, value: method });
    }
  });

  it('treats blank/absent as no filter', () => {
    expect(parseSalePaymentMethod(null)).toEqual({ ok: true, value: undefined });
    expect(parseSalePaymentMethod('')).toEqual({ ok: true, value: undefined });
  });

  it('rejects an unknown method and names the parameter', () => {
    const result = parseSalePaymentMethod('BITCOIN');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.param).toBe('paymentMethod');
      expect(result.message).toContain('paymentMethod');
      expect(result.message).toContain('CASH');
    }
  });
});
