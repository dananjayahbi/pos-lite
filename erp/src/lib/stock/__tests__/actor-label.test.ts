import { describe, it, expect } from 'vitest';

import { stockActorLabel, SYSTEM_ACTOR_LABEL } from '@/lib/stock/actor-label';

describe('stockActorLabel', () => {
  it('renders the staff display name instead of the email', () => {
    expect(stockActorLabel({ email: 'cashier1@ayurpos.dev' })).toBe('Cashier 1');
    expect(stockActorLabel({ email: 'stock.clerk@shop.lk' })).toBe('Stock Clerk');
  });

  it('keeps the automated-movement fallback', () => {
    expect(stockActorLabel(null)).toBe(SYSTEM_ACTOR_LABEL);
    expect(stockActorLabel(undefined)).toBe(SYSTEM_ACTOR_LABEL);
  });
});
