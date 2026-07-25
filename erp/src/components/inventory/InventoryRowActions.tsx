'use client';

import Link from 'next/link';
import { Archive, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryRowActionsProps {
  productId: string;
  productName: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
  onArchive?: ((id: string, isArchived: boolean) => void) | undefined;
  onDelete?: ((id: string) => void) | undefined;
}

/**
 * Row-level actions for the inventory table.
 *
 * Modularized so the table itself can stay focused on layout. Renders a fixed
 * order: View → Edit → Archive → Delete, hiding actions the user cannot run.
 */
export function InventoryRowActions({
  productId,
  productName,
  isArchived,
  canArchive,
  canDelete,
  onArchive,
  onDelete,
}: InventoryRowActionsProps) {
  const iconButton =
    'h-8 w-8 text-espresso/60 transition-colors hover:text-espresso';

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={iconButton}
        asChild
        aria-label={`View ${productName}`}
      >
        <Link href={`/inventory/${productId}`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={iconButton}
        asChild
        aria-label={`Edit ${productName}`}
      >
        <Link href={`/inventory/${productId}?edit=1`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>

      {canArchive && onArchive && (
        <Button
          variant="ghost"
          size="icon"
          className={iconButton}
          onClick={() => onArchive(productId, !isArchived)}
          aria-label={
            isArchived ? `Unarchive ${productName}` : `Archive ${productName}`
          }
        >
          <Archive className="h-4 w-4" />
        </Button>
      )}

      {canDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-espresso/60 transition-colors hover:text-destructive"
          onClick={() => onDelete(productId)}
          aria-label={`Delete ${productName}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}