'use client';

import type { Brand } from '@/hooks/useBrands';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { BrandDeleteButton } from '@/components/brands/BrandDeleteButton';

interface BrandListProps {
  brands: Brand[];
  canEdit: boolean;
  canDelete: boolean;
  selectedId?: string | null;
  onSelect?: (brand: Brand) => void;
  onEdit?: (brand: Brand) => void;
  onDelete?: (brand: Brand) => void;
}

export function BrandList({
  brands,
  canEdit,
  canDelete,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: BrandListProps) {
  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-sand bg-pearl p-8 text-center text-sm text-mist">
        No brands yet. Create your first brand above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sand bg-pearl p-2">
      {brands.map((brand) => {
        const isSelected = selectedId === brand.id;

        return (
          <div
            key={brand.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(brand)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(brand);
              }
            }}
            className={`flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-sand/50 ${
              isSelected ? 'bg-sand/70 ring-1 ring-espresso/20' : ''
            }`}
            aria-pressed={isSelected}
          >
            {/* Logo */}
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-8 w-8 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-mist/20 text-xs text-mist">
                —
              </div>
            )}

            {/* Name */}
            <span className="truncate font-body text-sm text-espresso">{brand.name}</span>

            {/* Product count badge */}
            <Badge variant="secondary" className="ml-auto bg-sand text-espresso text-xs">
              {brand._count.products}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  type="button"
                  className="rounded p-1 text-text-muted transition-colors hover:text-espresso"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(brand);
                  }}
                  aria-label={`Edit ${brand.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && brand._count.products === 0 && (
                <BrandDeleteButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(brand);
                  }}
                  brandName={brand.name}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
