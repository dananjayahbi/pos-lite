'use client';

import Link from 'next/link';
import { Archive, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RestoreProductButton } from '@/components/inventory/RestoreProductButton';

interface InventoryRowActionsProps {
  productId: string;
  productName: string;
  isArchived: boolean;
  /** M02-03 — row comes from the "Deleted" view; offer Restore instead. */
  isDeleted?: boolean;
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
 * In the "Deleted" view (M02-03) the row is soft-deleted, so the detail/edit
 * routes 404 and archive/delete are meaningless — only Restore is offered
 * (gated on the same `product:archive` permission the restore route requires).
 */
export function InventoryRowActions({
  productId,
  productName,
  isArchived,
  isDeleted = false,
  canArchive,
  canDelete,
  onArchive,
  onDelete,
}: InventoryRowActionsProps) {
  const iconButton =
    'h-8 w-8 text-espresso/60 transition-colors hover:text-espresso';

  if (isDeleted) {
    return (
      <div className="flex items-center gap-1">
        {canArchive && (
          <RestoreProductButton productId={productId} productName={productName} />
        )}
      </div>
    );
  }

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