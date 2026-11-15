import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';

const item = (variantId: string): Omit<CartItem, 'discountPercent'> => ({
  variantId,
  productName: `Product ${variantId}`,
  variantDescription: 'Default',
  sku: variantId.toUpperCase(),
  unitPrice: 100,
  quantity: 1,
});

describe('cart item order', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })),
    );
    useCartStore.setState({ items: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useCartStore.setState({ items: [] });
  });

  it('puts the most recently added product first', () => {
    useCartStore.getState().addItem(item('first'));
    useCartStore.getState().addItem(item('second'));

    expect(useCartStore.getState().items.map((line) => line.variantId)).toEqual([
      'second',
      'first',
    ]);
  });

  it('moves an existing product back to the top and increments its quantity', () => {
    useCartStore.getState().addItem(item('first'));
    useCartStore.getState().addItem(item('second'));
    useCartStore.getState().addItem(item('first'));

    const lines = useCartStore.getState().items;
    expect(lines.map((line) => line.variantId)).toEqual(['first', 'second']);
    expect(lines[0]?.quantity).toBe(2);
  });
});
