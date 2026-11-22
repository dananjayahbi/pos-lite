import { describe, expect, it } from 'vitest';

import { auditListMode } from '@/lib/audit/auditList.core';

/** ARGUS #455: an API failure must not look like a genuine empty filter. */
describe('auditListMode', () => {
  it('reports errors before loading or empty', () => {
    expect(auditListMode({ isLoading: false, isError: true, count: 0 })).toBe('error');
    expect(auditListMode({ isLoading: true, isError: true, count: 5 })).toBe('error');
  });

  it('reports loading and empty distinctly', () => {
    expect(auditListMode({ isLoading: true, isError: false, count: 0 })).toBe('loading');
    expect(auditListMode({ isLoading: false, isError: false, count: 0 })).toBe('empty');
    expect(auditListMode({ isLoading: false, isError: false, count: 3 })).toBe('ready');
  });
});
