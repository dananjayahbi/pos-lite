'use client';

import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import type { ProductListItem } from '@/hooks/useProducts';

interface ProductCardProps {
  product: ProductListItem;
  onAddDirectly: (variantId: string) => void;
  onOpenVariantModal: (productId: string) => void;
}

export function ProductCard({
  product,
  onAddDirectly,
  onOpenVariantModal,
}: ProductCardProps) {
  const variants = product.variants ?? [];
  const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);

  const firstImage = variants.find((v) => v.imageUrls.length > 0)?.imageUrls[0];

  const minPrice = variants.length > 0
    ? Math.min(...variants.map((v) => v.retailPrice))
    : 0;

  const handleClick = () => {
    if (totalStock === 0) {
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
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      className={`relative cursor-pointer rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden h-[165px] ${
        totalStock === 0 ? 'opacity-60' : ''
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
        {totalStock === 0 && (
          <span className="absolute top-1 right-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body text-[#9B2226] bg-[#9B2226]/10">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9B2226]" />
            Out of Stock
          </span>
        )}
        {totalStock > 0 && totalStock <= 5 && (
          <span className="absolute top-1 right-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body text-[#B7791F] bg-[#B7791F]/10">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#B7791F]" />
            Low
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
      {totalStock === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-linen/60">
          <span className="text-terracotta text-xs font-body">Out of Stock</span>
        </div>
      )}
    </div>
  );
}
