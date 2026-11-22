'use client';

import type { Category } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { Pencil, RotateCcw } from 'lucide-react';
import { ResourceDeleteButton, productsAssignedReason } from '@/components/shared/ResourceDeleteButton';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { shouldHandleRowKey } from '@/lib/catalog/listRowKeyboard.core';

interface CategoryListProps {
  categories: Category[];
  canEdit: boolean;
  canDelete: boolean;
  selectedId?: string | null | undefined;
  onSelect?: ((category: Category) => void) | undefined;
  onEdit?: ((category: Category) => void) | undefined;
  onDelete?: ((category: Category) => void) | undefined;
  /** Called from the Deleted view to restore a soft-deleted category. */
  onRestore?: ((category: Category) => void) | undefined;
}

export function CategoryList({
  categories,
  canEdit,
  canDelete,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onRestore,
}: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-sand bg-pearl p-8 text-center text-sm text-mist-ink">
        No categories yet. Create your first category above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sand bg-pearl p-2">
      {categories.map((cat) => {
        const isSelected = selectedId === cat.id;
        const isDeleted = Boolean(cat.deletedAt);

        return (
          <div
            key={cat.id}
            role={isDeleted ? undefined : 'button'}
            tabIndex={isDeleted ? -1 : 0}
            onClick={isDeleted ? undefined : () => onSelect?.(cat)}
            onKeyDown={(e) => {
              // Keys pressed on the edit/delete buttons bubble here; only keys
              // that originate on the row itself may select it (ARGUS #171).
              if (
                !isDeleted &&
                shouldHandleRowKey(e.key, e.target === e.currentTarget)
              ) {
                e.preventDefault();
                onSelect?.(cat);
              }
            }}
            className={`flex items-center gap-3 rounded px-2 py-1.5 transition-colors ${
              isDeleted ? '' : 'cursor-pointer hover:bg-sand/50'
            } ${isSelected ? 'bg-sand/70 ring-1 ring-espresso/20' : ''}`}
            aria-pressed={isDeleted ? undefined : isSelected}
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
              {isDeleted ? (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-espresso transition-colors hover:bg-sand/70"
                  onClick={() => onRestore?.(cat)}
                  aria-label={`Restore ${cat.name}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
              ) : (
                <>
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
                    <ResourceDeleteButton
                      canDelete
                      label={cat.name}
                      isDeleting={false}
                      onDelete={() => onDelete?.(cat)}
                      blockedReason={
                        cat._count.products > 0
                          ? productsAssignedReason(cat._count.products)
                          : undefined
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}