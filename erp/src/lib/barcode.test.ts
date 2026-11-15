import { describe, expect, it } from 'vitest';

import {
  barcodeSymbology,
  ean13CheckDigit,
  generateBarcode,
  INTERNAL_EAN13_PREFIX,
  isValidEan13,
} from '@/lib/barcode';

describe('ean13CheckDigit', () => {
  it('matches known GS1 check digits', () => {
    // 400638133393 → 1 (classic EAN-13 example from GS1 documentation)
    expect(ean13CheckDigit('400638133393')).toBe('1');
    // 978030640615 → 7 (ISBN-13 example)
    expect(ean13CheckDigit('978030640615')).toBe('7');
    // All-zero body has a zero check digit.
    expect(ean13CheckDigit('000000000000')).toBe('0');
  });
});

describe('isValidEan13', () => {
  it('accepts a valid 13-digit code', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('9780306406157')).toBe(true);
  });

  it('rejects wrong length, non-digits and bad check digits', () => {
    expect(isValidEan13('400638133393')).toBe(false);
    expect(isValidEan13('40063813339311')).toBe(false);
    expect(isValidEan13('40063813339X1')).toBe(false);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(isValidEan13('')).toBe(false);
  });
});

describe('generateBarcode', () => {
  it('always emits a valid internal EAN-13', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBarcode();
      expect(code).toHaveLength(13);
      expect(code.startsWith(INTERNAL_EAN13_PREFIX)).toBe(true);
      expect(isValidEan13(code)).toBe(true);
    }
  });

  it('is overwhelmingly unlikely to repeat', () => {
    const sample = new Set(Array.from({ length: 500 }, () => generateBarcode()));
    expect(sample.size).toBe(500);
  });
});

describe('barcodeSymbology', () => {
  it('uses EAN13 for generated codes and CODE128 for legacy values', () => {
    expect(barcodeSymbology(generateBarcode())).toBe('EAN13');
    expect(barcodeSymbology('DAB-00-POW-100G')).toBe('CODE128');
    expect(barcodeSymbology('12345678')).toBe('CODE128');
    expect(barcodeSymbology('4006381333932')).toBe('CODE128');
  });
});
