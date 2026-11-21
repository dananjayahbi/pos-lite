import { describe, expect, it } from 'vitest';

import {
  lowStockBadgeLabel,
  lowStockErrorMessage,
  resolveLowStockViewState,
  type LowStockViewInput,
} from '@/components/stock-control/lowStockState';

/**
 * ARGUS #213 — a failed low-stock feed must render the error state, never the
 * healthy "all variants are adequately stocked" empty state.
 */
function input(overrides: Partial<LowStockViewInput> = {}): LowStockViewInput {
  return {
    hasPermission: true,
    isError: false,
    isLoading: false,
    variantCount: 0,
    ...overrides,
  };
}

describe('resolveLowStockViewState', () => {
  it('shows the permission notice before anything else', () => {
    expect(resolveLowStockViewState(input({ hasPermission: false, isError: true }))).toBe('permission');
  });

  it('reports an error state when the feed failed', () => {
    expect(resolveLowStockViewState(input({ isError: true }))).toBe('error');
  });

  it('never falls through to empty when the request failed', () => {
    // The original defect: data was undefined → variantCount 0 → green empty.
    expect(resolveLowStockViewState(input({ isError: true, variantCount: 0 }))).not.toBe('empty');
  });

  it('outranks loading when both flags are set (refetch after a failure)', () => {
    expect(resolveLowStockViewState(input({ isError: true, isLoading: true }))).toBe('error');
  });

  it('shows loading on the first load', () => {
    expect(resolveLowStockViewState(input({ isLoading: true }))).toBe('loading');
  });

  it('shows the healthy empty state only on a successful empty response', () => {
    expect(resolveLowStockViewState(input({ variantCount: 0 }))).toBe('empty');
  });

  it('shows the list when rows came back', () => {
    expect(resolveLowStockViewState(input({ variantCount: 6 }))).toBe('list');
  });
});

describe('lowStockBadgeLabel', () => {
  it('uses a neutral dash — not 0 — on error', () => {
    expect(lowStockBadgeLabel('error', 0)).toBe('—');
  });

  it('hides the badge while loading or without permission', () => {
    expect(lowStockBadgeLabel('loading', 0)).toBeNull();
    expect(lowStockBadgeLabel('permission', 0)).toBeNull();
  });

  it('shows a real 0 only for a successful empty response', () => {
    expect(lowStockBadgeLabel('empty', 0)).toBe('0');
  });

  it('shows the total for a populated list', () => {
    expect(lowStockBadgeLabel('list', 6)).toBe('6');
  });
});

describe('lowStockErrorMessage', () => {
  it('surfaces the endpoint message', () => {
    expect(lowStockErrorMessage(new Error('Low stock query failed'))).toBe('Low stock query failed');
  });

  it('falls back when the error carries no usable message', () => {
    expect(lowStockErrorMessage(undefined)).toBe('The low stock feed could not be loaded.');
    expect(lowStockErrorMessage(new Error('   '))).toBe('The low stock feed could not be loaded.');
  });
});
