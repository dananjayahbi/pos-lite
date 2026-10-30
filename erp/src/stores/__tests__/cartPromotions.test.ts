import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCartStore } from '@/stores/cartStore';
import { createCartPromotionSnapshot, EMPTY_CART_PROMOTIONS } from '@/stores/cartPromotions';

// The store schedules a 300ms promotion re-evaluation on every mutation and
// restore. Fake timers keep the network out of these assertions.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: false }) })),
  );
  useCartStore.getState().clearCart();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const line = {
  variantId: 'variant-1',
  productName: 'Turmeric Curcumin Capsules',
  variantDescription: '60 caps',
  sku: 'TUR-60',
  unitPrice: 1977.4,
  quantity: 1,
};

const promotion = {
  promotionId: 'promo-1',
  label: '10% Off Everything',
  discountAmount: '395.48',
  promotionType: 'CART_PERCENTAGE',
  affectedLines: ['variant-1'],
};

function seedPricedCart() {
  useCartStore.setState({
    items: [{ ...line, discountPercent: 0 }],
    appliedPromotions: [promotion],
    skippedPromotions: [],
    totalPromotionDiscount: '395.48',
    appliedPromoCode: 'WELCOME10',
  });
}

describe('cart promotion restore', () => {
  it('clearCart drops the promotion state', () => {
    seedPricedCart();
    useCartStore.getState().clearCart();
    const state = useCartStore.getState();
    expect(state.appliedPromotions).toEqual([]);
    expect(state.totalPromotionDiscount).toBe('0');
    expect(state.appliedPromoCode).toBeNull();
  });

  it('restoreCartWithPromotions brings back the undone cart with its promotions', () => {
    seedPricedCart();
    const snapshot = {
      items: useCartStore.getState().items,
      cartDiscountPercent: 0,
      cartDiscountAmount: 25,
      promotions: createCartPromotionSnapshot(useCartStore.getState()),
    };

    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);

    useCartStore.getState().restoreCartWithPromotions(snapshot);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.cartDiscountAmount).toBe(25);
    expect(state.appliedPromotions).toEqual([promotion]);
    expect(state.totalPromotionDiscount).toBe('395.48');
    expect(state.appliedPromoCode).toBe('WELCOME10');
    expect(state.isEvaluatingPromotions).toBe(false);
  });

  it('restoreCartWithPromotions tolerates a snapshot captured before promotions existed', () => {
    useCartStore.getState().restoreCartWithPromotions({
      items: [{ ...line, discountPercent: 0 }],
      cartDiscountPercent: 0,
      cartDiscountAmount: 0,
      promotions: createCartPromotionSnapshot(undefined),
    });
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.appliedPromotions).toEqual([]);
    expect(state.totalPromotionDiscount).toBe('0');
  });
});

describe('createCartPromotionSnapshot', () => {
  it('returns a copy of the empty default when given nothing', () => {
    const snap = createCartPromotionSnapshot(null);
    expect(snap).toEqual(EMPTY_CART_PROMOTIONS);
    expect(snap).not.toBe(EMPTY_CART_PROMOTIONS);
  });

  it('keeps promotion arrays by reference but normalises missing fields', () => {
    const snap = createCartPromotionSnapshot({ appliedPromotions: [promotion] });
    expect(snap.appliedPromotions).toEqual([promotion]);
    expect(snap.skippedPromotions).toEqual([]);
    expect(snap.totalPromotionDiscount).toBe('0');
    expect(snap.appliedPromoCode).toBeNull();
  });
});
