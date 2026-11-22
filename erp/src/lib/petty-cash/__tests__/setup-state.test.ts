import { describe, expect, it } from 'vitest';

import {
  multiplePettyCashFundsMessage,
  resolvePettyCashReadiness,
} from '@/lib/petty-cash/setup-state';

describe('petty-cash setup readiness (ARGUS #408)', () => {
  it('reports not configured for an empty tenant', () => {
    expect(resolvePettyCashReadiness([])).toEqual({
      status: 'not-configured',
      fundId: null,
      fundCount: 0,
    });
  });

  it('reports ready for exactly one active fund', () => {
    expect(resolvePettyCashReadiness([{ id: 'fund-1' }])).toEqual({
      status: 'ready',
      fundId: 'fund-1',
      fundCount: 1,
    });
  });

  it('never picks the first fund when duplicates exist', () => {
    expect(resolvePettyCashReadiness([{ id: 'fund-1' }, { id: 'fund-2' }])).toEqual({
      status: 'multiple',
      fundId: null,
      fundCount: 2,
    });
  });

  it('names the duplicate count in the operator message', () => {
    expect(multiplePettyCashFundsMessage(3)).toContain('3');
    expect(multiplePettyCashFundsMessage(3)).toContain('funds');
  });
});
