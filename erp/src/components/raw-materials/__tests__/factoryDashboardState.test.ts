import { describe, expect, it } from 'vitest';

import {
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
