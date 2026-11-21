import { create } from 'zustand';
import Decimal from 'decimal.js';
import type { AppliedDiscount, SkippedPromotion } from '@/lib/services/promotion.service';
import type { CFDCartPayload } from '@/lib/cfdEmitter';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import { createCartPromotionSnapshot } from '@/stores/cartPromotions';
import type { CartPromotionSnapshot } from '@/stores/cartPromotions';
import type { TaxRuleValue } from '@/lib/constants/product-options';

export interface CartItem {
  variantId: string;
  productName: string;
  variantDescription: string;
  sku: string;
  unitPrice: number;       // serialized as number, Decimal used internally for math
  quantity: number;
  discountPercent: number;  // 0-100
  /** Available stock when the line was added; caps the cart quantity. */
  stockQuantity?: number | undefined;
  /** Product tax rule; drives the per-line VAT/SSCL/exempt preview. */
  taxRule?: TaxRuleValue | undefined;
}

/** Store-wide rates used to preview the tax the sale service will charge. */
export interface CartTaxRates {
  vatRate: number;
  ssclRate: number;
}

interface CartState {
  items: CartItem[];
  cartDiscountPercent: number;
  cartDiscountAmount: number;
  authorizingManagerId: string | null;
  activeLineId: string | null;
  /** Tenant VAT rate (percent), used for the per-line cart tax preview. */
  vatRate: number;
  /** Tenant SSCL rate (percent), used for the per-line cart tax preview. */
  ssclRate: number;
  linkedReturnId: string | null;
  exchangeCredit: number | null;
  exchangeReturnRef: string | null;
  linkedCustomerId: string | null;
  linkedCustomerName: string | null;
  linkedCustomerPhone: string | null;
  linkedCustomerCreditBalance: string | null;
  appliedStoreCredit: string;

  // Promotion state
  appliedPromotions: AppliedDiscount[];
  skippedPromotions: SkippedPromotion[];
  totalPromotionDiscount: string;
  appliedPromoCode: string | null;
  isEvaluatingPromotions: boolean;

  // Held-sale tracking (used to update in-place on re-hold)
  heldSaleId: string | null;

  // Mutators
  addItem: (item: Omit<CartItem, 'discountPercent'>) => { added: number; limited: boolean };
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  setLineDiscount: (variantId: string, discountPercent: number) => void;
  setCartDiscount: (mode: 'percent' | 'fixed', value: number) => void;
  setAuthorizingManager: (managerId: string | null) => void;
  setActiveLine: (variantId: string | null) => void;
  setTaxRates: (vatRate: number, ssclRate: number) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[], cartDiscountPercent: number, cartDiscountAmount: number) => void;
  restoreCartWithPromotions: (snapshot: {
    items: CartItem[];
    cartDiscountPercent: number;
    cartDiscountAmount: number;
    promotions?: CartPromotionSnapshot;
    /** Credit from an EXCHANGE return, persisted so a reload keeps it. */
    exchange?: { returnId: string; credit: number; ref: string } | null;
  }) => void;
  setExchangeCredit: (returnId: string, credit: number, ref: string) => void;
  clearExchangeCredit: () => void;
  linkCustomer: (id: string, name: string, phone: string, creditBalance: string) => void;
  unlinkCustomer: () => void;
  setAppliedStoreCredit: (amount: string) => void;
  evaluatePromotions: () => void;
  setPromoCode: (code: string | null) => void;
  setHeldSaleId: (id: string | null) => void;
}

let promoDebounceTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePromoEval(get: () => CartState) {
  if (promoDebounceTimer !== undefined) clearTimeout(promoDebounceTimer);
  promoDebounceTimer = setTimeout(() => {
    get().evaluatePromotions();
  }, 300);
}

function sendCFDUpdate(
  state: CartState,
  statusOverride?: CFDCartPayload['status'],
  extra?: { change?: number },
) {
  const status = statusOverride ?? (state.items.length > 0 ? 'ACTIVE' : 'IDLE');

  const items = state.items.map((item) => {
    const lineTotal = new Decimal(item.unitPrice)
      .times(item.quantity)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    return {
      productName: item.productName,
      variantName: item.variantDescription,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal,
    };
  });

  const { subtotal, discountEffective, total } = getCartTotal(
    state.items,
    state.cartDiscountPercent,
    state.cartDiscountAmount,
    { vatRate: state.vatRate, ssclRate: state.ssclRate },
    state.totalPromotionDiscount,
  );

  const payload: Omit<CFDCartPayload, 'tenantSlug'> = {
    items,
    subtotal: subtotal.toNumber(),
    discount: discountEffective.toNumber(),
    total: total.toNumber(),
    appliedPromotions: state.appliedPromotions.map((p) => ({ id: p.promotionId, name: p.label })),
    ...(state.linkedCustomerName ? { customerName: state.linkedCustomerName } : {}),
    status,
    ...(extra?.change !== undefined && { change: extra.change }),
  };

  fetch('/api/cfd/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err: unknown) => {
    console.warn('CFD update failed:', err);
  });
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cartDiscountPercent: 0,
  cartDiscountAmount: 0,
  authorizingManagerId: null,
  activeLineId: null,
  vatRate: 0, // loaded from tenant settings by the POS cart
  ssclRate: 0, // loaded from tenant settings by the POS cart
  linkedReturnId: null,
  exchangeCredit: null,
  exchangeReturnRef: null,
  linkedCustomerId: null,
  linkedCustomerName: null,
  linkedCustomerPhone: null,
  linkedCustomerCreditBalance: null,
  appliedStoreCredit: '0',

  appliedPromotions: [],
  skippedPromotions: [],
  totalPromotionDiscount: '0',
  appliedPromoCode: null,
  isEvaluatingPromotions: false,
  heldSaleId: null,

  addItem: (item) => {
    // Never let the cart exceed the stock known at add time; checkout would
    // fail with Insufficient stock and waste the cashier's time (ARGUS #64).
    const existing = get().items.find((i) => i.variantId === item.variantId);
    const currentQty = existing?.quantity ?? 0;
    const available = Number.isFinite(item.stockQuantity)
      ? Math.max(0, Math.floor(item.stockQuantity as number))
      : Number.POSITIVE_INFINITY;
    const requestedQty = currentQty + item.quantity;
    const nextQty = Math.min(requestedQty, available);
    const added = Math.max(0, nextQty - currentQty);

    if (added <= 0) {
      return { added: 0, limited: true };
    }

    set((state) => {
      // The cart is newest-first so the product the cashier just scanned is
      // always visible at the top of the list instead of below the fold.
      const current = state.items.find((i) => i.variantId === item.variantId);
      if (current) {
        return {
          items: [
            { ...current, quantity: nextQty, stockQuantity: item.stockQuantity ?? current.stockQuantity },
            ...state.items.filter((i) => i.variantId !== item.variantId),
          ],
        };
      }
      return {
        items: [
          {
            ...item,
            quantity: nextQty,
            discountPercent: 0,
          },
          ...state.items,
        ],
      };
    });
    schedulePromoEval(get);
    sendCFDUpdate(get());
    return { added, limited: nextQty < requestedQty };
  },

  removeItem: (variantId) => {
    set((state) => ({
      items: state.items.filter((i) => i.variantId !== variantId),
      activeLineId: state.activeLineId === variantId ? null : state.activeLineId,
    }));
    schedulePromoEval(get);
    sendCFDUpdate(get());
  },

  updateQuantity: (variantId, quantity) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.variantId !== variantId) return item;
        const max = Number.isFinite(item.stockQuantity)
          ? Math.max(1, Math.floor(item.stockQuantity as number))
          : Number.POSITIVE_INFINITY;
        return { ...item, quantity: Math.min(Math.max(1, quantity), max) };
      }),
    }));
    schedulePromoEval(get);
    sendCFDUpdate(get());
  },

  setLineDiscount: (variantId, discountPercent) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.variantId === variantId
          ? { ...i, discountPercent: Math.max(0, Math.min(100, discountPercent)) }
          : i,
      ),
    }));
    schedulePromoEval(get);
    sendCFDUpdate(get());
  },

  setCartDiscount: (mode, value) => {
    set(() => {
      const safeValue = Math.max(0, value);
      return mode === 'percent'
        ? { cartDiscountPercent: Math.min(100, safeValue), cartDiscountAmount: 0 }
        : { cartDiscountPercent: 0, cartDiscountAmount: safeValue };
    });
    sendCFDUpdate(get());
  },

  setAuthorizingManager: (managerId) => set({ authorizingManagerId: managerId }),

  setActiveLine: (variantId) =>
    set((state) => ({
      activeLineId: state.activeLineId === variantId ? null : variantId,
    })),

  setTaxRates: (vatRate, ssclRate) => {
    set({ vatRate, ssclRate });
    sendCFDUpdate(get());
  },

  clearCart: () => {
    set({
      items: [],
      cartDiscountPercent: 0,
      cartDiscountAmount: 0,
      authorizingManagerId: null,
      activeLineId: null,
      linkedReturnId: null,
      exchangeCredit: null,
      exchangeReturnRef: null,
      linkedCustomerId: null,
      linkedCustomerName: null,
      linkedCustomerPhone: null,
      linkedCustomerCreditBalance: null,
      appliedStoreCredit: '0',
      appliedPromotions: [],
      skippedPromotions: [],
      totalPromotionDiscount: '0',
      appliedPromoCode: null,
      isEvaluatingPromotions: false,
      heldSaleId: null,
    });
    sendCFDUpdate(get(), 'IDLE');
  },

  replaceCart: (items, cartDiscountPercent, cartDiscountAmount) => {
    set({ items, cartDiscountPercent, cartDiscountAmount, authorizingManagerId: null, activeLineId: null });
    sendCFDUpdate(get());
  },

  /**
   * Restores a previously captured cart (undo after clear, held-sale retrieve,
   * IndexedDB reload) together with the promotion state that was priced against
   * those lines. Clearing the cart drops the promotions, so restoring the lines
   * alone leaves the cart at full price with an empty Promotions row.
   * Promotion state is then re-evaluated in the background to catch promotions
   * that changed while the cart was parked.
   */
  restoreCartWithPromotions: ({
    items,
    cartDiscountPercent,
    cartDiscountAmount,
    promotions,
    exchange,
  }) => {
    const restored = createCartPromotionSnapshot(promotions);
    set({
      items,
      cartDiscountPercent,
      cartDiscountAmount,
      authorizingManagerId: null,
      activeLineId: null,
      appliedPromotions: restored.appliedPromotions,
      skippedPromotions: restored.skippedPromotions,
      totalPromotionDiscount: restored.totalPromotionDiscount,
      appliedPromoCode: restored.appliedPromoCode,
      isEvaluatingPromotions: false,
      linkedReturnId: exchange?.returnId ?? null,
      exchangeCredit: exchange?.credit ?? null,
      exchangeReturnRef: exchange?.ref ?? null,
    });
    sendCFDUpdate(get());
    if (items.length > 0) schedulePromoEval(get);
  },

  setExchangeCredit: (returnId, credit, ref) =>
    set({ linkedReturnId: returnId, exchangeCredit: credit, exchangeReturnRef: ref }),

  clearExchangeCredit: () =>
    set({ linkedReturnId: null, exchangeCredit: null, exchangeReturnRef: null }),

  linkCustomer: (id, name, phone, creditBalance) => {
    set({ linkedCustomerId: id, linkedCustomerName: name, linkedCustomerPhone: phone, linkedCustomerCreditBalance: creditBalance, appliedStoreCredit: '0' });
    sendCFDUpdate(get());
  },

  unlinkCustomer: () => {
    set({ linkedCustomerId: null, linkedCustomerName: null, linkedCustomerPhone: null, linkedCustomerCreditBalance: null, appliedStoreCredit: '0' });
    sendCFDUpdate(get());
  },

  setAppliedStoreCredit: (amount) =>
    set({ appliedStoreCredit: amount }),

  evaluatePromotions: () => {
    const state = get();
    if (state.items.length === 0) {
      set({ appliedPromotions: [], skippedPromotions: [], totalPromotionDiscount: '0', isEvaluatingPromotions: false });
      return;
    }
    set({ isEvaluatingPromotions: true });

    const cartLines = state.items.map((item) => {
      const lineTotal = new Decimal(item.unitPrice).times(item.quantity);
      const manualDisc = item.discountPercent > 0
        ? lineTotal.times(item.discountPercent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
        : undefined;
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        ...(manualDisc !== undefined && { manualDiscountAmount: manualDisc }),
      };
    });

    const body: Record<string, unknown> = { cartLines };
    if (state.linkedCustomerId) body.customerId = state.linkedCustomerId;
    if (state.appliedPromoCode) body.promoCode = state.appliedPromoCode;

    fetch('/api/store/promotions/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          set({
            appliedPromotions: json.data.appliedDiscounts,
            skippedPromotions: json.data.skippedPromotions,
            totalPromotionDiscount: json.data.totalDiscountAmount,
            isEvaluatingPromotions: false,
          });
        } else {
          set({ isEvaluatingPromotions: false });
        }
      })
      .catch(() => {
        set({ isEvaluatingPromotions: false });
      });
  },

  setPromoCode: (code) =>
    set({ appliedPromoCode: code }),

  setHeldSaleId: (id) =>
    set({ heldSaleId: id }),
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

/**
 * Effective tax rate (as a fraction) for one cart line, exactly as the sales
 * service resolves it from the product's tax rule and the tenant rates.
 */
export function getLineTaxRate(
  taxRule: TaxRuleValue | undefined,
  { vatRate, ssclRate }: CartTaxRates,
): Decimal {
  switch (taxRule ?? 'STANDARD_VAT') {
    case 'SSCL':
      return new Decimal(ssclRate).div(100);
    case 'EXEMPT':
      return new Decimal(0);
    case 'STANDARD_VAT':
    default:
      return new Decimal(vatRate).div(100);
  }
}

/**
 * The discount amount the sales API must receive.
 *
 * `discountAmount` is the only discount channel the API understands, while the
 * POS shows two rows (manual cart discount + promotions). Folding the
 * promotion total into the payload keeps the persisted sale total equal to the
 * amount due the cashier sees — without it, a promotion-discounted cart is
 * stored at full price and a promotion-zeroed cart is rejected as a non-zero
 * `NONE` tender.
 */
export function getSaleDiscountAmount(
  subtotal: Decimal | number | string,
  cartDiscountEffective: Decimal | number | string,
  totalPromotionDiscount: Decimal | number | string,
): Decimal {
  const subtotalDecimal = new Decimal(subtotal);
  const combined = new Decimal(cartDiscountEffective).plus(new Decimal(totalPromotionDiscount));
  return Decimal.min(combined, Decimal.max(subtotalDecimal, 0)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
}

export function getCartTotal(
  items: CartItem[],
  cartDiscountPercent: number,
  cartDiscountAmount: number,
  taxRates: CartTaxRates,
  totalPromotionDiscount: Decimal | number | string = 0,
): {
  subtotal: Decimal;
  discountEffective: Decimal;
  saleDiscount: Decimal;
  taxAmount: Decimal;
  taxRatesApplied: number[];
  total: Decimal;
} {
  const subtotal = getCartSubtotal(items);
  const discountEffective = getCartDiscountEffective(subtotal, cartDiscountPercent, cartDiscountAmount);
  // The sales API receives one combined discount (manual cart discount +
  // promotions) and apportions it across the lines before taxing them.
  // Mirrored here so the cart's tax and total match the saved sale.
  const saleDiscount = getSaleDiscountAmount(subtotal, discountEffective, totalPromotionDiscount);
  const lineTotals = items.map(getLineTotalAfterDiscount);
  const discountShares = allocateCartDiscountShares(lineTotals, saleDiscount);

  const ratesApplied = new Set<number>();
  let taxAmount = new Decimal(0);
  items.forEach((item, index) => {
    const taxableLine = Decimal.max(lineTotals[index]!.minus(discountShares[index]!), 0);
    const rate = getLineTaxRate(item.taxRule, taxRates);
    if (rate.greaterThan(0)) ratesApplied.add(rate.times(100).toNumber());
    taxAmount = taxAmount.plus(
      taxableLine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    );
  });
  taxAmount = taxAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const total = subtotal
    .minus(saleDiscount)
    .plus(taxAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotal,
    discountEffective,
    saleDiscount,
    taxAmount,
    taxRatesApplied: [...ratesApplied],
    total,
  };
}
