'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, X, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { ProductCard } from '@/components/pos/ProductCard';
import { VariantSelectionModal } from '@/components/pos/VariantSelectionModal';
import { toast } from 'sonner';
import { usePOSProducts } from '@/hooks/usePOSProducts';
import { useCartStore } from '@/stores/cartStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

export function ProductGrid() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const { data, isLoading, isError } = usePOSProducts();

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

  // Clear category when searching
  useEffect(() => {
    if (debouncedSearch) setSelectedCategoryId(null);
  }, [debouncedSearch]);

  // Derive unique categories from products
  const categories = useMemo(() => {
    if (!data?.data) return [];
    const catMap = new Map<string, string>();
    data.data.forEach((p) => {
      if (p.category) catMap.set(p.category.id, p.category.name);
    });
    return Array.from(catMap, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    if (!data?.data) return [];
    let products = data.data;

    if (selectedCategoryId) {
      products = products.filter((p) => p.category?.id === selectedCategoryId);
    }

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.variants?.some(
            (v) =>
              v.sku.toLowerCase().includes(term) ||
              v.barcode?.toLowerCase().includes(term),
          ),
      );
    }

    return products;
  }, [data, selectedCategoryId, debouncedSearch]);

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
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[165px] rounded-lg bg-linen" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-mist">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">Failed to load products. Please refresh.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mist">
            <ShoppingBag className="h-12 w-12 mb-2" />
            <p className="font-body text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddDirectly={(variantId) => {
                  const product = filteredProducts.find(p => p.variants?.some(v => v.id === variantId));
                  const variant = product?.variants?.find(v => v.id === variantId);
                  if (product && variant) {
                    addItem({
                      variantId: variant.id,
                      productName: product.name,
                      variantDescription: [variant.size, variant.colour].filter(Boolean).join(' / ') || 'Default',
                      sku: variant.sku,
                      unitPrice: Number(variant.retailPrice),
                      quantity: 1,
                    });
                    toast.success(`Added ${product.name} to cart`);
                  }
                }}
                onOpenVariantModal={(productId) => setActiveProductId(productId)}
              />
            ))}
          </div>
        )}
      </div>

      <VariantSelectionModal
        productId={activeProductId}
        onClose={() => setActiveProductId(null)}
      />
    </div>
  );
}
