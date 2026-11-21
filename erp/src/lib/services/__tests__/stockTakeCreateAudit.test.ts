import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS } from '@/lib/services/audit.service';

describe('stock-take create audit (ARGUS #211)', () => {
  it('has a dedicated creation action so the trail starts at creation', () => {
    expect(AUDIT_ACTIONS.STOCK_TAKE_CREATED).toBe('STOCK_TAKE_CREATED');
  });
});
