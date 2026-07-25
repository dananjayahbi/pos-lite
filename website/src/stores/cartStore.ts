/**
 * Storefront cart store.
 *
 * Client-side cart state persisted to `localStorage` so that:
 *   - Reloads preserve the cart
 *   - Multiple tabs stay in sync (storage event)
 *   - Each tenant keeps its own cart (keyed by tenant slug)
 *
 * The store never touches the network — the website has no order backend yet.
 * Checkout is a future work item; for now the cart drawer surfaces totals
 * and a "Checkout coming soon" CTA.
 *
 * Selector helpers (`selectCartCount`, `selectCartSubtotal`, …) are provided
 * so components can subscribe to derived slices without re-rendering on
 * unrelated changes.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PublicProductVariant } from '@/types/website.types';

// ── Types ────────────────────────────────────────────────────────────────────

/** A snapshot of the product/variant info baked into the cart line. */
export interface CartLineSnapshot {
  variantId: string;
  productId: string;
  productName: string;
  variantSku: string;
  /** Price in LKR at the time of add (snapshot, not live). */
  price: number;
  /** Primary variant image, used as the line thumbnail. */
  image: string;
  /** Maximum stock available — quantity stepper clamps to this. */
  maxStock: number;
}

export interface CartLine extends CartLineSnapshot {
  quantity: number;
  /** ISO timestamp the line was last added (for "recently added" UI hints). */
  addedAt: string;
}

/** Per-tenant cart bucket. */
interface TenantCart {
  lines: CartLine[];
}

export interface CartState {
  /** Map<tenantSlug, TenantCart> — keeps tenants isolated. */
  carts: Record<string, TenantCart>;
  /** Which tenant's drawer is currently open (null = closed). */
  drawerTenant: string | null;
}

export interface CartActions {
  addItem: (tenantSlug: string, variant: PublicProductVariant, product: { id: string; name: string }, quantity?: number) => void;
  removeItem: (tenantSlug: string, variantId: string) => void;
  setQuantity: (tenantSlug: string, variantId: string, quantity: number) => void;
  increment: (tenantSlug: string, variantId: string) => void;
  decrement: (tenantSlug: string, variantId: string) => void;
  clear: (tenantSlug: string) => void;
  openDrawer: (tenantSlug: string) => void;
  closeDrawer: () => void;
  toggleDrawer: (tenantSlug: string) => void;
}

export type CartStore = CartState & CartActions;

// ── Storage helpers ──────────────────────────────────────────────────────────

/**
 * `localStorage` is only safe to access on the client. During SSR
 * `zustand/persist` evaluates the storage factory once, so we wrap it to
 * return a no-op storage on the server.
 */
const safeStorage = createJSONStorage<{ carts: Record<string, TenantCart> }>(() => {
  if (typeof window === 'undefined') {
    // No-op storage during SSR/hydration phase.
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
});

const STORAGE_KEY = 'ruhunu-cart';
const STORAGE_VERSION = 1;

/** Get the cart lines for a tenant (always returns an array). */
export function getCartLines(state: CartState, tenantSlug: string): CartLine[] {
  return state.carts[tenantSlug]?.lines ?? [];
}

function ensureTenant(state: CartState, tenantSlug: string): TenantCart {
  return state.carts[tenantSlug] ?? { lines: [] };
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      carts: {},
      drawerTenant: null,

      addItem: (tenantSlug, variant, product, quantity = 1) => {
        const tenant = ensureTenant(get(), tenantSlug);
        const existing = tenant.lines.find((l) => l.variantId === variant.id);
        const snapshot: CartLineSnapshot = {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          variantSku: variant.sku,
          price: variant.retailPrice,
          image: variant.imageUrls?.[0] ?? '',
          maxStock: variant.stockQuantity,
        };

        const lines = existing
          ? existing.quantity + quantity > snapshot.maxStock
            ? tenant.lines.map((l) =>
                l.variantId === variant.id
                  ? { ...l, quantity: snapshot.maxStock, addedAt: nowIso() }
                  : l,
              )
            : tenant.lines.map((l) =>
                l.variantId === variant.id
                  ? { ...l, quantity: l.quantity + quantity, addedAt: nowIso() }
                  : l,
              )
          : [
              ...tenant.lines,
              {
                ...snapshot,
                quantity: Math.min(quantity, snapshot.maxStock),
                addedAt: nowIso(),
              },
            ];

        set({
          carts: { ...get().carts, [tenantSlug]: { lines } },
          drawerTenant: tenantSlug,
        });
      },

      removeItem: (tenantSlug, variantId) => {
        const tenant = ensureTenant(get(), tenantSlug);
        const lines = tenant.lines.filter((l) => l.variantId !== variantId);
        set({
          carts: { ...get().carts, [tenantSlug]: { lines } },
        });
      },

      setQuantity: (tenantSlug, variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(tenantSlug, variantId);
          return;
        }
        const tenant = ensureTenant(get(), tenantSlug);
        const lines = tenant.lines.map((l) =>
          l.variantId === variantId
            ? {
                ...l,
                quantity: Math.min(quantity, l.maxStock),
                addedAt: nowIso(),
              }
            : l,
        );
        set({
          carts: { ...get().carts, [tenantSlug]: { lines } },
        });
      },

      increment: (tenantSlug, variantId) => {
        const tenant = ensureTenant(get(), tenantSlug);
        const line = tenant.lines.find((l) => l.variantId === variantId);
        if (!line) return;
        get().setQuantity(tenantSlug, variantId, line.quantity + 1);
      },

      decrement: (tenantSlug, variantId) => {
        const tenant = ensureTenant(get(), tenantSlug);
        const line = tenant.lines.find((l) => l.variantId === variantId);
        if (!line) return;
        get().setQuantity(tenantSlug, variantId, line.quantity - 1);
      },

      clear: (tenantSlug) => {
        set({
          carts: { ...get().carts, [tenantSlug]: { lines: [] } },
        });
      },

      openDrawer: (tenantSlug) => set({ drawerTenant: tenantSlug }),
      closeDrawer: () => set({ drawerTenant: null }),
      toggleDrawer: (tenantSlug) =>
        set((s) => ({
          drawerTenant: s.drawerTenant === tenantSlug ? null : tenantSlug,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: safeStorage,
      // Only persist the per-tenant carts — never persist drawer UI state.
      partialize: (state) => ({ carts: state.carts }),
    },
  ),
);

// ── Selectors (stable references via `useCartStore` selector) ───────────────

export const selectCartCount = (tenantSlug: string) => (state: CartStore) =>
  getCartLines(state, tenantSlug).reduce((sum, l) => sum + l.quantity, 0);

export const selectCartSubtotal = (tenantSlug: string) => (state: CartStore) =>
  getCartLines(state, tenantSlug).reduce(
    (sum, l) => sum + l.quantity * l.price,
    0,
  );

export const selectIsInCart = (tenantSlug: string, variantId: string) =>
  (state: CartStore) =>
    getCartLines(state, tenantSlug).some((l) => l.variantId === variantId);

export const selectLineQuantity =
  (tenantSlug: string, variantId: string) => (state: CartStore) =>
    getCartLines(state, tenantSlug).find((l) => l.variantId === variantId)
      ?.quantity ?? 0;