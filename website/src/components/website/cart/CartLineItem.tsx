"use client";

/**
 * A single line in the cart drawer / cart page.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [thumb]  Product name                  Rs. 1,200            │
 *   │          SKU                            [−] 2 [+]  [remove] │
 *   └──────────────────────────────────────────────────────────────┘
 */

import React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';
import { useCartStore } from '@/stores/cartStore';
import { QuantityStepper } from './QuantityStepper';

interface CartLineItemProps {
  tenantSlug: string;
  variantId: string;
  productName: string;
  variantSku: string;
  image: string;
  price: number;
  quantity: number;
  maxStock: number;
  /** Called when the user clicks the product link so the drawer can close. */
  onNavigate?: () => void;
}

export function CartLineItem({
  tenantSlug,
  variantId,
  productId,
  productName,
  variantSku,
  image,
  price,
  quantity,
  maxStock,
  onNavigate,
}: CartLineItemProps & { productId: string }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const lineTotal = price * quantity;

  return (
    <div className="flex gap-3 border-b border-gray-100 py-4 last:border-b-0">
      {/* Thumbnail */}
      <Link
        href={ROUTES.product(tenantSlug, productId)}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-gray-100"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
            No image
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={ROUTES.product(tenantSlug, productId)}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className="line-clamp-2 text-sm font-medium text-gray-900 hover:underline"
            >
              {productName}
            </Link>
            <p className="text-xs text-gray-500">SKU: {variantSku}</p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(tenantSlug, variantId)}
            aria-label={`Remove ${productName} from cart`}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <QuantityStepper
            value={quantity}
            min={1}
            max={maxStock}
            size="sm"
            onChange={(q) => setQuantity(tenantSlug, variantId, q)}
          />
          <p className="text-sm font-semibold tabular-nums">{formatLKR(lineTotal)}</p>
        </div>
      </div>
    </div>
  );
}