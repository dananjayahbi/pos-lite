import { describe, expect, it } from 'vitest';

import {
  resolveCashFlowReportState,
  type CashFlowReportStateInput,
} from '@/lib/reports/cashflowReportState';

const base: CashFlowReportStateInput = {
  canView: true,
  isPermissionLoading: false,
  hasGenerated: true,
  isLoading: false,
  error: null,
  hasActivity: true,
};

describe('resolveCashFlowReportState', () => {
  it('waits for the session before showing anything', () => {
    const state = resolveCashFlowReportState({
      ...base,
      isPermissionLoading: true,
      hasGenerated: false,
    });

    expect(state.mode).toBe('permission-loading');
    expect(state.showReport).toBe(false);
    expect(state.canGenerate).toBe(false);
  });

  it('shows access denied when the user lacks the permission', () => {
    const state = resolveCashFlowReportState({ ...base, canView: false });

    expect(state.mode).toBe('denied');
    expect(state.showReport).toBe(false);
    expect(state.canGenerate).toBe(false);
    expect(state.message).toContain('permission');
  });

  it('shows the idle prompt before Generate', () => {
    const state = resolveCashFlowReportState({ ...base, hasGenerated: false });
    expect(state.mode).toBe('idle');
    expect(state.canGenerate).toBe(true);
  });

  it('hides any stale report while a new request loads', () => {
    const state = resolveCashFlowReportState({ ...base, isLoading: true });
    expect(state.mode).toBe('loading');
    expect(state.showReport).toBe(false);
  });

  it('keeps the report hidden and offers retry after a server failure', () => {
    const state = resolveCashFlowReportState({
      ...base,
      error: { status: 500, message: 'Server exploded' },
    });

    expect(state.mode).toBe('error');
    expect(state.showReport).toBe(false);
    expect(state.canRetry).toBe(true);
    expect(state.message).toBe('Server exploded');
  });

  it('turns a server 403 into the access-denied state without retry', () => {
    const state = resolveCashFlowReportState({
      ...base,
      error: { status: 403 },
    });

    expect(state.mode).toBe('denied');
    expect(state.showReport).toBe(false);
    expect(state.canRetry).toBe(false);
  });

  it('uses the empty state when the period has no activity', () => {
    const state = resolveCashFlowReportState({ ...base, hasActivity: false });
    expect(state.mode).toBe('empty');
    expect(state.showEmpty).toBe(true);
    expect(state.showReport).toBe(false);
  });

  it('shows the report only when every check passes', () => {
    const state = resolveCashFlowReportState(base);
    expect(state.mode).toBe('ready');
    expect(state.showReport).toBe(true);
  });
});
