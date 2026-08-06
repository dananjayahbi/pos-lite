'use client';

import type { Category } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { CategoryDeleteButton } from '@/components/categories/CategoryDeleteButton';
import { CategoryIcon } from '@/components/categories/CategoryIcon';

interface CategoryListProps {
  categories: Category[];
  canEdit: boolean;
  canDelete: boolean;
  selectedId?: string | null;
  onSelect?: (category: Category) => void;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
}

export function CategoryList({
  categories,
  canEdit,
  canDelete,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-sand bg-pearl p-8 text-center text-sm text-mist">
        No categories yet. Create your first category above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sand bg-pearl p-2">
      {categories.map((cat) => {
        const isSelected = selectedId === cat.id;

        return (
          <div
            key={cat.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(cat)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(cat);
              }
            }}
            className={`flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-sand/50 ${
              isSelected ? 'bg-sand/70 ring-1 ring-espresso/20' : ''
            }`}
            aria-pressed={isSelected}
          >
            <CategoryIcon
              imageUrl={cat.imageUrl}
              name={cat.name}
              size={22}
            />

            {/* Name */}
            <span className="flex-1 truncate font-body text-sm text-espresso">
              {cat.name}
            </span>

            {/* Product count badge */}
            <Badge variant="secondary" className="bg-sand text-espresso text-xs">
              {cat._count.products}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  type="button"
                  className="rounded p-1 text-text-muted transition-colors hover:text-espresso"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(cat);
                  }}
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <CategoryDeleteButton
                  isDeleting={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(cat);
                  }}
                  categoryName={cat.name}
                  blockedReason={
                    cat._count.products > 0
                      ? `${cat._count.products} product${cat._count.products === 1 ? '' : 's'} assigned — reassign or archive them first`
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}