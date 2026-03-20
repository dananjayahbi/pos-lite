import { create } from 'zustand';
import Decimal from 'decimal.js';

export interface CartItem {
  variantId: string;
  productName: string;
  variantDescription: string;
  sku: string;
  unitPrice: number;       // serialized as number, Decimal used internally for math
  quantity: number;
  discountPercent: number;  // 0-100
}

interface CartState {
  items: CartItem[];
  cartDiscountPercent: number;
  cartDiscountAmount: number;
  authorizingManagerId: string | null;
  activeLineId: string | null;
  taxRate: number; // approximate display tax rate (e.g. 18)
  linkedReturnId: string | null;
  exchangeCredit: number | null;
  exchangeReturnRef: string | null;

  // Mutators
  addItem: (item: Omit<CartItem, 'discountPercent'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  setLineDiscount: (variantId: string, discountPercent: number) => void;
  setCartDiscount: (mode: 'percent' | 'fixed', value: number) => void;
  setAuthorizingManager: (managerId: string | null) => void;
  setActiveLine: (variantId: string | null) => void;
  setTaxRate: (rate: number) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[], cartDiscountPercent: number, cartDiscountAmount: number) => void;
  setExchangeCredit: (returnId: string, credit: number, ref: string) => void;
  clearExchangeCredit: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  cartDiscountPercent: 0,
  cartDiscountAmount: 0,
  authorizingManagerId: null,
  activeLineId: null,
  taxRate: 0, // will be set on terminal init
  linkedReturnId: null,
  exchangeCredit: null,
  exchangeReturnRef: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.variantId === item.variantId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, { ...item, discountPercent: 0 }] };
    }),

  removeItem: (variantId) =>
    set((state) => ({
      items: state.items.filter((i) => i.variantId !== variantId),
      activeLineId: state.activeLineId === variantId ? null : state.activeLineId,
    })),

  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.variantId === variantId ? { ...i, quantity: Math.max(1, quantity) } : i,
      ),
    })),

  setLineDiscount: (variantId, discountPercent) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.variantId === variantId
          ? { ...i, discountPercent: Math.max(0, Math.min(100, discountPercent)) }
          : i,
      ),
    })),

  setCartDiscount: (mode, value) =>
    set(() => {
      const safeValue = Math.max(0, value);
      return mode === 'percent'
        ? { cartDiscountPercent: Math.min(100, safeValue), cartDiscountAmount: 0 }
        : { cartDiscountPercent: 0, cartDiscountAmount: safeValue };
    }),

  setAuthorizingManager: (managerId) => set({ authorizingManagerId: managerId }),

  setActiveLine: (variantId) =>
    set((state) => ({
      activeLineId: state.activeLineId === variantId ? null : variantId,
    })),

  setTaxRate: (rate) => set({ taxRate: rate }),

  clearCart: () =>
    set({
      items: [],
      cartDiscountPercent: 0,
      cartDiscountAmount: 0,
      authorizingManagerId: null,
      activeLineId: null,
      linkedReturnId: null,
      exchangeCredit: null,
      exchangeReturnRef: null,
    }),

  replaceCart: (items, cartDiscountPercent, cartDiscountAmount) =>
    set({ items, cartDiscountPercent, cartDiscountAmount, authorizingManagerId: null, activeLineId: null }),

  setExchangeCredit: (returnId, credit, ref) =>
    set({ linkedReturnId: returnId, exchangeCredit: credit, exchangeReturnRef: ref }),

  clearExchangeCredit: () =>
    set({ linkedReturnId: null, exchangeCredit: null, exchangeReturnRef: null }),
}));

// ── Computed selectors (pure functions, not stored state) ────────────

export function getLineTotalAfterDiscount(item: CartItem): Decimal {
  const lineTotal = new Decimal(item.unitPrice).times(item.quantity);
  if (item.discountPercent > 0) {
    const discount = lineTotal.times(item.discountPercent).div(100);
    return lineTotal.minus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return lineTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function getCartSubtotal(items: CartItem[]): Decimal {
  return items.reduce(
    (sum, item) => sum.plus(getLineTotalAfterDiscount(item)),
    new Decimal(0),
  );
}

export function getCartDiscountEffective(
  subtotal: Decimal,
  cartDiscountPercent: number,
  cartDiscountAmount: number,
): Decimal {
  if (cartDiscountPercent > 0) {
    return subtotal.times(cartDiscountPercent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return new Decimal(cartDiscountAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function getCartTaxAmount(subtotalAfterDiscount: Decimal, taxRate: number): Decimal {
  return subtotalAfterDiscount.times(taxRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function getCartTotal(
  items: CartItem[],
  cartDiscountPercent: number,
  cartDiscountAmount: number,
  taxRate: number,
): { subtotal: Decimal; discountEffective: Decimal; taxAmount: Decimal; total: Decimal } {
  const subtotal = getCartSubtotal(items);
  const discountEffective = getCartDiscountEffective(subtotal, cartDiscountPercent, cartDiscountAmount);
  const subtotalAfterDiscount = subtotal.minus(discountEffective);
  const taxAmount = getCartTaxAmount(subtotalAfterDiscount, taxRate);
  const total = subtotalAfterDiscount.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { subtotal, discountEffective, taxAmount, total };
}
