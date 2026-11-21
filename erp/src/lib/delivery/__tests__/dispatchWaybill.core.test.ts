import { describe, expect, it } from 'vitest';

import { dispatchWaybillAction } from '@/lib/delivery/dispatchWaybill.core';

describe('dispatchWaybillAction (ARGUS #278)', () => {
  it('marks a pre-dispatch label as a preview draft', () => {
    const action = dispatchWaybillAction(null);
    expect(action.kind).toBe('preview');
    expect(action.label).toContain('Preview');
    expect(action.hint).toContain('Draft');
    expect(dispatchWaybillAction(undefined).kind).toBe('preview');
    expect(dispatchWaybillAction('   ').kind).toBe('preview');
  });

  it('prints normally once a courier waybill exists', () => {
    const action = dispatchWaybillAction('TE-12345678');
    expect(action).toEqual({ kind: 'print', label: 'Waybill', hint: null });
  });
});
