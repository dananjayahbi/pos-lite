import { describe, expect, it } from 'vitest';

import {
  VALUATION_COST_BASIS,
  VALUATION_COST_BASIS_LABEL,
  VALUATION_COST_BASIS_NOTE,
  valuationCostBasisLabel,
  valuationCostBasisNote,
} from '@/lib/pricing/valuationBasis';

/**
 * ARGUS #218 - the cost figure is a current-cost snapshot and must be labelled
 * as such, never as acquisition/historical cost.
 */
describe('stock valuation cost basis', () => {
  it('identifies the basis as current cost', () => {
    expect(VALUATION_COST_BASIS).toBe('current-cost');
    expect(VALUATION_COST_BASIS_LABEL).toBe('At current cost');
    expect(valuationCostBasisLabel()).toBe('At current cost');
  });

  it('states the limitation in the shared note', () => {
    expect(VALUATION_COST_BASIS_NOTE).toMatch(/current cost price/i);
    expect(VALUATION_COST_BASIS_NOTE).toMatch(/not historical acquisition cost/i);
    expect(valuationCostBasisNote()).toBe(VALUATION_COST_BASIS_NOTE);
  });

});
