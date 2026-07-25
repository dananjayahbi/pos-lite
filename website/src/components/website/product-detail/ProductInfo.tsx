'use client';

import React, { useState } from 'react';
import type { PublicProduct, PublicProductVariant } from '@/types/website.types';
import { formatLKR } from '@/lib/utils';
import { useCartStore, selectLineQuantity } from '@/stores/cartStore';
import { AddToCartButton } from '@/components/website/cart/AddToCartButton';
import { QuantityStepper } from '@/components/website/cart/QuantityStepper';

interface ProductInfoProps {
  product: PublicProduct;
  tenantSlug: string;
}

/**
 * Product name, price, variant selector, quantity picker, and add-to-cart CTA.
 */
export function ProductInfo({ product, tenantSlug }: ProductInfoProps) {
  const variants = product.variants ?? [];
  const [selected, setSelected] = useState<PublicProductVariant | undefined>(
    product.primaryVariant ?? variants[0],
  );

  const price = selected?.retailPrice ?? variants[0]?.retailPrice ?? 0;
  const inStock = (selected?.stockQuantity ?? 0) > 0;
  const currentQtyInCart = useCartStore(
    selected
      ? selectLineQuantity(tenantSlug, selected.id)
      : () => 0,
  );
  const [qty, setQty] = useState(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          {product.name}
        </h1>
        {(product.tags ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(product.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price */}
      <p className="text-xl font-semibold">{formatLKR(price)}</p>

      {/* Variant selector */}
      {variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wider text-gray-600">
            Select variant
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v)}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  selected?.id === v.id
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 hover:border-gray-500'
                }`}
              >
                {v.sku}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock status */}
      <p className={`text-sm ${inStock ? 'text-green-700' : 'text-red-600'}`}>
        {inStock
          ? `In stock (${selected?.stockQuantity} available)`
          : 'Out of stock'}
      </p>

      {/* Description */}
      {product.description && (
        <div className="prose prose-sm max-w-none text-gray-700">
          <p>{product.description}</p>
        </div>
      )}

      {/* Quantity + Add to cart */}
      {inStock && selected && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <QuantityStepper
            value={qty}
            min={1}
            max={selected.stockQuantity}
            onChange={setQty}
            ariaLabel="Quantity"
          />
          <div className="sm:ml-2">
            <AddToCartButton
              tenantSlug={tenantSlug}
              variant={selected}
              product={{ id: product.id, name: product.name }}
              quantity={qty}
              size="lg"
            />
          </div>
        </div>
      )}

      {!inStock && (
        <AddToCartButton
          tenantSlug={tenantSlug}
          variant={selected}
          product={{ id: product.id, name: product.name }}
          size="lg"
        />
      )}

      {currentQtyInCart > 0 && (
        <p className="text-xs text-gray-500">
          {currentQtyInCart} of this item {currentQtyInCart === 1 ? 'is' : 'are'} already in your cart.
        </p>
      )}
    </div>
  );
}
