import { describe, expect, it } from 'vitest';
import { canAuthorizeReturn, returnStaffLabel } from '../returnAuthorizer';

describe('return authorizer helpers (ARGUS #95)', () => {
  it('only lets manager-tier roles authorize a return', () => {
    expect(canAuthorizeReturn('MANAGER')).toBe(true);
    expect(canAuthorizeReturn('OWNER')).toBe(true);
    expect(canAuthorizeReturn('SUPER_ADMIN')).toBe(true);
    expect(canAuthorizeReturn('CASHIER')).toBe(false);
    expect(canAuthorizeReturn('STOCK_CLERK')).toBe(false);
    expect(canAuthorizeReturn(null)).toBe(false);
    expect(canAuthorizeReturn(undefined)).toBe(false);
  });

  it('renders a safe label when the authorizer or their email is missing', () => {
    expect(returnStaffLabel(null)).toBe('Not recorded');
    expect(returnStaffLabel(undefined)).toBe('Not recorded');
    expect(returnStaffLabel({ email: null })).toBe('Not recorded');
    expect(returnStaffLabel({ email: '' })).toBe('Not recorded');
  });

  it('derives the display name from a present email', () => {
    expect(returnStaffLabel({ email: 'store.manager@ayurpos.dev' })).toBe('Store Manager');
  });
});
