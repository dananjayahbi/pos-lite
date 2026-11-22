'use client';

import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import { productCardStockState } from '@/components/pos/productStockState';
import type { ProductListItem } from '@/hooks/useProducts';

interface ProductCardProps {
  product: ProductListItem;
  onAddDirectly: (variantId: string) => void;
  onOpenVariantModal: (productId: string) => void;
  /** Roving tabindex supplied by the grid; -1 for off-path cards. */
  tabIndex?: number;
  onFocus?: () => void;
}

export function ProductCard({
  product,
  onAddDirectly,
  onOpenVariantModal,
  tabIndex = 0,
  onFocus,
}: ProductCardProps) {
  const variants = product.variants ?? [];
  const { totalStock, outOfStock, hasLowStockVariant, lowStockVariantCount } =
    productCardStockState(variants);

  // Icon-size surface: prefer the generated thumbnail; fall back to the full
  // image for legacy products that predate thumbnail generation.
  const variantWithImage = variants.find((v) => v.imageUrls.length > 0);
  const firstImage =
    product.mainImageThumbnailUrl ??
    product.mainImageUrl ??
    (variantWithImage
      ? variantWithImage.thumbnailImageUrls?.[0] ?? variantWithImage.imageUrls[0]
      : undefined);

  // Any variant with an expired or near-expiry batch triggers the badge.
  const hasNearExpiry = variants.some((v) =>
    (v.batchTrackings ?? []).some((b) => {
      if (!b.expiryDate) return false;
      const diff = new Date(b.expiryDate).getTime() - Date.now();
      return diff <= 30 * 86_400_000;
    }),
  );

  const minPrice = variants.length > 0
    ? Math.min(...variants.map((v) => v.retailPrice))
    : 0;

  const handleClick = () => {
    if (outOfStock) {
      toast('This product is out of stock');
      return;
    }
    if (variants.length === 1 && variants[0]) {
      onAddDirectly(variants[0].id);
    } else {
      onOpenVariantModal(product.id);
    }
  };

  return (
    <div
      role="button"
      data-pos-product=""
      tabIndex={tabIndex}
      aria-label={`${product.name}, ${formatRupee(minPrice)}${
        outOfStock
          ? ', out of stock'
          : hasLowStockVariant
            ? `, low stock on ${lowStockVariantCount} variant${lowStockVariantCount === 1 ? '' : 's'}`
            : ''
      }`}
      aria-disabled={outOfStock}
      onFocus={onFocus}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`relative cursor-pointer rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden h-[165px] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-linen ${
        outOfStock ? 'opacity-60' : ''
      }`}
    >
      {/* Image area — upper 60% */}
      <div className="relative h-[60%] bg-linen">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={product.name}
            fill
            className="object-cover"
            sizes="140px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-terracotta" />
          </div>
        )}

        {/* Stock badge */}
        {outOfStock && (
          <span className="absolute top-1 right-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body text-[#9B2226] bg-[#9B2226]/10">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9B2226]" />
            Out of Stock
          </span>
        )}
        {!outOfStock && hasLowStockVariant && (
          <span
            className="absolute top-1 right-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body text-[#B7791F] bg-[#B7791F]/10"
            title={`${lowStockVariantCount} variant${lowStockVariantCount === 1 ? '' : 's'} at or below the low-stock threshold`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#B7791F]" />
            Low
          </span>
        )}

        {/* Near-expiry badge (doc 30) */}
        {hasNearExpiry && (
          <span className="absolute top-1 left-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body text-[#9B2226] bg-[#9B2226]/10">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9B2226]" />
            Expiring
          </span>
        )}
      </div>

      {/* Info area — lower 40% */}
      <div className="h-[40%] px-2 py-1.5 flex flex-col justify-between">
        <p className="font-body text-[13px] text-espresso line-clamp-2 leading-tight">
          {product.name}
        </p>
        <p className="font-mono text-[13px] text-terracotta">
          {formatRupee(minPrice)}
        </p>
      </div>

      {/* Out of stock overlay */}
      {outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-linen/60">
          <span className="text-terracotta text-xs font-body">Out of Stock</span>
        </div>
      )}
    </div>
  );
}
