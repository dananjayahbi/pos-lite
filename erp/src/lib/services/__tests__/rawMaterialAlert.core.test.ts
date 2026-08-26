import { describe, it, expect } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { evaluateRawMaterialAlert } from '@/lib/services/rawMaterialAlert.service';

function material(quantity: string, threshold: string) {
  return {
    quantity: new Prisma.Decimal(quantity),
    lowStockThreshold: new Prisma.Decimal(threshold),
  };
}

describe('rawMaterialAlert — evaluateRawMaterialAlert', () => {
  it('returns null when no threshold is configured', () => {
    expect(evaluateRawMaterialAlert(material('10', '0'))).toBeNull();
  });

  it('flags CRITICAL when quantity is zero or negative', () => {
    expect(evaluateRawMaterialAlert(material('0', '5'))).toBe('CRITICAL');
    expect(evaluateRawMaterialAlert(material('-2', '5'))).toBe('CRITICAL');
  });

  it('flags LOW when quantity is at or below threshold but above zero', () => {
    expect(evaluateRawMaterialAlert(material('5', '5'))).toBe('LOW');
    expect(evaluateRawMaterialAlert(material('3', '10'))).toBe('LOW');
    expect(evaluateRawMaterialAlert(material('10', '10'))).toBe('LOW');
  });

  it('returns null when quantity is above threshold', () => {
    expect(evaluateRawMaterialAlert(material('20', '5'))).toBeNull();
  });
});
