'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { ProductCard } from '@/components/pos/ProductCard';
import { VariantSelectionModal } from '@/components/pos/VariantSelectionModal';
import { toast } from 'sonner';
import { usePOSProducts } from '@/hooks/usePOSProducts';
import { usePOSCategories } from '@/hooks/usePOSCategories';
import { useCartStore } from '@/stores/cartStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

export function ProductGrid() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const addItem = useCartStore((s) => s.addItem);

  const { data: categoriesData } = usePOSCategories();
  const { data, isLoading, isError, isTransitioning } = usePOSProducts({
    categoryId: selectedCategoryId,
    search: debouncedSearch,
    page,
  });

  const products = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const categories = categoriesData ?? [];

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

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
          <input
            type="text"
            placeholder="Search products, SKU, barcode…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-mist bg-white py-2 pl-9 pr-9 font-body text-sm text-espresso placeholder:text-mist focus:border-sand focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-espresso"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scan notification strip */}
      {scanNotification && (
        <div className={`mx-4 mb-1 rounded-md px-3 py-1.5 font-body text-[13px] text-white transition-all ${
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
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading || isTransitioning ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[165px] rounded-lg bg-mist/30" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-mist">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">Failed to load products. Please refresh.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mist">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddDirectly={(variantId) => {
                    const prod = products.find((p) => p.variants?.some((v) => v.id === variantId));
                    const variant = prod?.variants?.find((v) => v.id === variantId);
                    if (prod && variant) {
                      addItem({
                        variantId: variant.id,
                        productName: prod.name,
                        variantDescription: [variant.size, variant.colour].filter(Boolean).join(' / ') || 'Default',
                        sku: variant.sku,
                        unitPrice: Number(variant.retailPrice),
                        quantity: 1,
                      });
                      toast.success(`Added ${prod.name} to cart`);
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
                  className="p-1.5 rounded-lg border border-mist/50 text-espresso disabled:opacity-30 hover:bg-sand/20 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-body text-xs text-espresso/70">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-mist/50 text-espresso disabled:opacity-30 hover:bg-sand/20 transition-colors"
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
        onClose={() => setActiveProductId(null)}
      />
    </div>
  );
}
