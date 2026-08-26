'use client';

import { ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RawMaterialRowActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  canAdjust: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
}

export function RawMaterialRowActions({
  canEdit,
  canDelete,
  canAdjust,
  onEdit,
  onDelete,
  onAdjust,
}: RawMaterialRowActionsProps) {
  const iconButton = 'h-8 w-8 text-espresso/60 transition-colors hover:text-espresso';

  return (
    <div className="flex items-center justify-end gap-1">
      {canAdjust && (
        <Button
          variant="ghost"
          size="icon"
          className={iconButton}
          aria-label="Adjust stock"
          title="Adjust stock"
          onClick={onAdjust}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className={iconButton}
          aria-label="Edit"
          title="Edit"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className={`${iconButton} hover:text-red-600`}
          aria-label="Delete"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
