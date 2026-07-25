'use client';

import { Loader2, Lock, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CategoryDeleteButtonProps {
  isDeleting: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  categoryName: string;
  /** When true, render as a disabled lock icon with an explanation tooltip. */
  blockedReason?: string | undefined;
}

export function CategoryDeleteButton({
  isDeleting,
  disabled,
  onClick,
  categoryName,
  blockedReason,
}: CategoryDeleteButtonProps) {
  if (blockedReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded p-1 text-warning/70 transition-colors hover:text-warning disabled:cursor-not-allowed"
              disabled
              onClick={(e) => e.stopPropagation()}
              aria-label={`Cannot delete ${categoryName}: ${blockedReason}`}
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-espresso text-pearl text-xs">
            {blockedReason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <button
      type="button"
      className="rounded p-1 text-danger/80 transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled || isDeleting}
      aria-label={`Delete ${categoryName}`}
      aria-busy={isDeleting}
    >
      {isDeleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
