import { describe, expect, it } from 'vitest';

import {
  buildFactoryStockPopulation,
  factoryAlertStockStatus,
  factoryFeedErrorMessage,
  factoryKpiValue,
  resolveFactoryFeedState,
  type FactoryFeedStateInput,
} from '@/components/raw-materials/factoryDashboardState';

/**
 * ARGUS #244 — a failed factory feed must render the error state, never an
 * empty/all-clear panel or a "0" KPI.
 */
function input(overrides: Partial<FactoryFeedStateInput> = {}): FactoryFeedStateInput {
  return { isError: false, isLoading: false, itemCount: 0, ...overrides };
}

describe('resolveFactoryFeedState', () => {
  it('reports an error even when rows are still cached', () => {
    expect(resolveFactoryFeedState(input({ isError: true, itemCount: 4 }))).toBe('error');
  });

  it('never falls through to empty or data when the request failed', () => {
    expect(resolveFactoryFeedState(input({ isError: true, itemCount: 0 }))).not.toBe('empty');
    expect(resolveFactoryFeedState(input({ isError: true, itemCount: 4 }))).not.toBe('data');
  });

  it('outranks loading when both flags are set (refetch after failure)', () => {
    expect(resolveFactoryFeedState(input({ isError: true, isLoading: true }))).toBe('error');
  });

  it('shows loading before empty', () => {
    expect(resolveFactoryFeedState(input({ isLoading: true, itemCount: 0 }))).toBe('loading');
  });

  it('shows empty only for a successful zero-row response', () => {
    expect(resolveFactoryFeedState(input({ itemCount: 0 }))).toBe('empty');
  });

  it('shows data for a successful non-empty response', () => {
    expect(resolveFactoryFeedState(input({ itemCount: 2 }))).toBe('data');
  });
});

describe('factoryKpiValue', () => {
  it('never renders 0 for a failed or loading feed', () => {
    expect(factoryKpiValue('error', 0)).toBe('-');
    expect(factoryKpiValue('loading', 0)).toBe('-');
    expect(factoryKpiValue('error', 12)).toBe('-');
  });

  it('renders a real number only for loaded data', () => {
    expect(factoryKpiValue('data', 0)).toBe('0');
    expect(factoryKpiValue('data', 12)).toBe('12');
    expect(factoryKpiValue('data', undefined)).toBe('-');
  });
});

describe('buildFactoryStockPopulation', () => {
  function alert(overrides: Partial<Parameters<typeof buildFactoryStockPopulation>[0][number]>) {
    return {
      rawMaterialId: 'rm-1',
      name: 'Material',
      quantity: 1,
      lowStockThreshold: 5,
      severity: 'LOW' as const,
      ...overrides,
    };
  }

  it('drives the KPI counts and list from one population', () => {
    const population = buildFactoryStockPopulation([
      alert({ rawMaterialId: 'low', name: 'Low row', quantity: 2, severity: 'LOW' }),
      alert({ rawMaterialId: 'out', name: 'Out row', quantity: 0, severity: 'CRITICAL' }),
    ]);

    expect(population.lowCount).toBe(1);
    expect(population.outOfStockCount).toBe(1);
    expect(population.flaggedCount).toBe(2);
    expect(population.items.map((item) => item.rawMaterialId)).toEqual(['out', 'low']);
  });

  it('includes a sixth low-stock row instead of truncating at the old limit of five', () => {
    const alerts = Array.from({ length: 6 }, (_, index) =>
      alert({ rawMaterialId: `rm-${index}`, name: `Material ${index}`, quantity: 2 }),
    );

    expect(buildFactoryStockPopulation(alerts).flaggedCount).toBe(6);
  });

  it('sorts critical rows first, then by quantity, then name', () => {
    const population = buildFactoryStockPopulation([
      alert({ rawMaterialId: 'low-b', name: 'B', quantity: 4 }),
      alert({ rawMaterialId: 'out', name: 'Out', quantity: 0, severity: 'CRITICAL' }),
      alert({ rawMaterialId: 'low-a', name: 'A', quantity: 4 }),
    ]);

    expect(population.items.map((item) => item.rawMaterialId)).toEqual([
      'out',
      'low-a',
      'low-b',
    ]);
  });

  it('normalises a stale severity so zero stock is always CRITICAL', () => {
    const population = buildFactoryStockPopulation([
      alert({ rawMaterialId: 'zero', quantity: 0, lowStockThreshold: 0, severity: 'LOW' }),
    ]);

    expect(population.items[0]?.severity).toBe('CRITICAL');
    expect(population.outOfStockCount).toBe(1);
    expect(population.lowCount).toBe(0);
  });

  it('does not double-count a duplicated material row', () => {
    const population = buildFactoryStockPopulation([
      alert({ rawMaterialId: 'same', quantity: 1 }),
      alert({ rawMaterialId: 'same', quantity: 1 }),
    ]);

    expect(population.flaggedCount).toBe(1);
  });

  it('maps severity to the badge vocabulary', () => {
    expect(factoryAlertStockStatus('CRITICAL')).toBe('OUT');
    expect(factoryAlertStockStatus('LOW')).toBe('LOW');
  });
});

describe('factoryFeedErrorMessage', () => {
  it('surfaces the feed message', () => {
    expect(factoryFeedErrorMessage(new Error('Alerts query failed'), 'fallback')).toBe(
      'Alerts query failed',
    );
  });

  it('falls back when the error carries no usable message', () => {
    expect(factoryFeedErrorMessage(undefined, 'The alerts feed could not be loaded.')).toBe(
      'The alerts feed could not be loaded.',
    );
    expect(factoryFeedErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
  });
});
