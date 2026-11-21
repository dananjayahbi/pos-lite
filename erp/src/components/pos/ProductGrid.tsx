'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { ProductCard } from '@/components/pos/ProductCard';
import { VariantSelectionModal } from '@/components/pos/VariantSelectionModal';
import { POSScanInput } from '@/components/pos/POSScanInput';
import { toast } from 'sonner';
import { usePOSProducts } from '@/hooks/usePOSProducts';
import { usePOSCategories } from '@/hooks/usePOSCategories';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { useCartStore } from '@/stores/cartStore';
import { useBarcodeScanner, useBarcodeScanToCart } from '@/hooks/useBarcodeScanner';
import { focusPOSBarcodeInput, isPOSDialogOpen } from '@/lib/pos/keyboard';
import type { ProductListItem } from '@/hooks/useProducts';

type ProductVariant = NonNullable<ProductListItem['variants']>[number];

export function ProductGrid() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [focusedProductIndex, setFocusedProductIndex] = useState(0);
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: categoriesData } = usePOSCategories();
  const { data, isLoading, isError, isTransitioning } = usePOSProducts({
    categoryId: selectedCategoryId,
    search: debouncedSearch,
    page,
  });

  const products = useMemo(() => data?.data ?? [], [data?.data]);
  const totalPages = data?.meta?.totalPages ?? 1;
  const categories = categoriesData ?? [];
  const safeFocusedProductIndex =
    products.length === 0 ? 0 : Math.min(focusedProductIndex, products.length - 1);

  const addVariantToCart = useCallback(
    (product: ProductListItem, variant: ProductVariant) => {
      addItem({
        variantId: variant.id,
        productName: product.name,
        variantDescription: [variant.form, variant.packSize].filter(Boolean).join(' / ') || 'Default',
        sku: variant.sku,
        unitPrice: Number(variant.retailPrice),
        quantity: 1,
        taxRule: product.taxRule ?? 'STANDARD_VAT',
      });
      toast.success(`Added ${product.name} to cart`);
    },
    [addItem],
  );

  // Barcode scanner integration
  const handleScan = useCallback((productName: string, variantDescription: string) => {
    setScanNotification({
      type: 'success',
      message: `Added: ${productName} ${variantDescription}`,
    });
    setTimeout(() => setScanNotification(null), 2500);
  }, []);

  useBarcodeScanner({
    enabled: activeProductId === null,
    onScan: handleScan,
  });

  const { scanBarcode } = useBarcodeScanToCart(handleScan);

  /**
   * Last-resort SKU resolver for the keyboard box. The barcode API only knows
   * barcodes, and the on-screen list may still be loading (or filtered/paged),
   * so an exact SKU is resolved through the product search endpoint.
   */
  const lookupVariantBySku = useCallback(
    async (code: string): Promise<{ product: ProductListItem; variant: ProductVariant } | null> => {
      if (!/^[a-zA-Z0-9._-]{4,40}$/.test(code)) return null;
      try {
        const res = await fetch(`/api/store/products?search=${encodeURIComponent(code)}&limit=10`);
        if (!res.ok) return null;
        const json = await res.json();
        const list: ProductListItem[] = Array.isArray(json?.data) ? json.data : [];
        const lowered = code.toLowerCase();
        for (const product of list) {
          const variant = (product.variants ?? []).find(
            (candidate) => candidate.sku.toLowerCase() === lowered,
          );
          if (variant) return { product, variant };
        }
        return null;
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * Enter / scan resolution: an exact SKU or barcode already on screen is added
   * without a round trip; otherwise the barcode API resolves it, then an exact
   * SKU lookup covers products that are not on the current page. Plain search
   * text (spaces, short words) is left intact so the list keeps filtering.
   */
  const handleScanSubmit = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim();
      if (!code) return false;

      const lowered = code.toLowerCase();
      const onScreen = products
        .flatMap((product) => (product.variants ?? []).map((variant) => ({ product, variant })))
        .find(({ variant }) =>
          variant.sku.toLowerCase() === lowered || variant.barcode?.toLowerCase() === lowered,
        );

      if (onScreen) {
        if (onScreen.variant.stockQuantity <= 0) {
          toast.warning(`Out of stock: ${onScreen.product.name}`);
          return true;
        }
        addVariantToCart(onScreen.product, onScreen.variant);
        handleScan(onScreen.product.name, [onScreen.variant.form, onScreen.variant.packSize].filter(Boolean).join(' / ') || 'Default');
        return true;
      }

      const looksLikeBarcode = /^[a-zA-Z0-9-]{8,20}$/.test(code);
      if (looksLikeBarcode) {
        const barcodeResult = await scanBarcode(code);
        // Found but out of stock: consume the input, the warning already showed.
        if (barcodeResult.ok || barcodeResult.productName) return true;
      }

      const skuMatch = await lookupVariantBySku(code);
      if (skuMatch) {
        if (skuMatch.variant.stockQuantity <= 0) {
          toast.warning(`Out of stock: ${skuMatch.product.name}`);
          return true;
        }
        addVariantToCart(skuMatch.product, skuMatch.variant);
        handleScan(skuMatch.product.name, [skuMatch.variant.form, skuMatch.variant.packSize].filter(Boolean).join(' / ') || 'Default');
        return true;
      }

      if (looksLikeBarcode) toast.error(`Unknown barcode: ${code}`);
      return false;
    },
    [products, addVariantToCart, handleScan, scanBarcode, lookupVariantBySku],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when category or search changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, debouncedSearch]);

  // Clear category when searching
  useEffect(() => {
    if (debouncedSearch) setSelectedCategoryId(null);
  }, [debouncedSearch]);

  const getProductCards = useCallback(() => {
    const root = gridRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[data-pos-product]'));
  }, []);

  const moveProductFocus = useCallback((nextIndex: number) => {
    const cards = getProductCards();
    if (cards.length === 0) return;
    const clamped = Math.min(Math.max(nextIndex, 0), cards.length - 1);
    cards.forEach((card, index) => {
      card.tabIndex = index === clamped ? 0 : -1;
    });
    cards[clamped]?.focus();
    setFocusedProductIndex(clamped);
  }, [getProductCards]);

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target !== event.currentTarget && !target.closest('[data-pos-product]')) {
        return;
      }
      const cards = getProductCards();
      if (cards.length === 0) return;
      const current = cards.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;

      // Uniform auto-fill grid: the first row's card count is the stride.
      const firstRowTop = cards[0]?.offsetTop;
      const columns = Math.max(1, cards.filter((card) => card.offsetTop === firstRowTop).length);

      let next = current;
      switch (event.key) {
        case 'ArrowRight':
          next = current + 1;
          break;
        case 'ArrowLeft':
          next = current - 1;
          break;
        case 'ArrowDown':
          next = current + columns;
          break;
        case 'ArrowUp':
          next = current - columns;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = cards.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      moveProductFocus(next);
    },
    [getProductCards, moveProductFocus],
  );

  usePOSShortcuts([
    {
      key: 'F2',
      allowInEditable: true,
      handler: () => {
        if (!isPOSDialogOpen()) focusPOSBarcodeInput();
      },
    },
    {
      key: '/',
      handler: () => {
        if (!isPOSDialogOpen()) focusPOSBarcodeInput();
      },
    },
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Always-focused barcode / search input */}
      <div className="px-4 pt-4 pb-2">
        <POSScanInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          onScan={handleScanSubmit}
        />
      </div>

      {/* Scan notification strip */}
      {scanNotification && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-4 mb-1 rounded-md px-3 py-1.5 font-body text-[13px] text-white transition-all ${
          scanNotification.type === 'success' ? 'bg-[#2D6A4F]' :
          scanNotification.type === 'warning' ? 'bg-amber-600' :
          'bg-red-600'
        }`}>
          {scanNotification.message}
        </div>
      )}

      {/* Category tabs */}
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
      />

      {/* Product grid or loading/empty */}
      <div
        ref={gridRef}
        role="group"
        aria-label="Product results"
        onKeyDown={handleGridKeyDown}
        className="flex-1 overflow-y-auto p-4"
      >
        {isLoading || isTransitioning ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[165px] rounded-lg bg-mist/30" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-mist-ink">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">Failed to load products. Please refresh.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mist-ink">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  tabIndex={index === safeFocusedProductIndex ? 0 : -1}
                  onFocus={() => setFocusedProductIndex(index)}
                  onAddDirectly={(variantId) => {
                    const prod = products.find((p) => p.variants?.some((v) => v.id === variantId));
                    const variant = prod?.variants?.find((v) => v.id === variantId);
                    if (prod && variant) {
                      addVariantToCart(prod, variant);
                      focusPOSBarcodeInput();
                    }
                  }}
                  onOpenVariantModal={(productId) => setActiveProductId(productId)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4 pb-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-mist/50 text-espresso transition-colors hover:bg-sand/20 disabled:opacity-30"
                  aria-label="Previous product page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-body text-xs text-espresso/70" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-mist/50 text-espresso transition-colors hover:bg-sand/20 disabled:opacity-30"
                  aria-label="Next product page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <VariantSelectionModal
        productId={activeProductId}
        onClose={() => {
          setActiveProductId(null);
          focusPOSBarcodeInput();
        }}
      />
    </div>
  );
}
