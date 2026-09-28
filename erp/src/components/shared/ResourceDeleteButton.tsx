'use client';

import { Loader2, Lock, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * M04-02 — the single delete affordance shared by every resource list
 * (categories, brands, …). Extracted from CategoryDeleteButton so the
 * blocked-state UX (disabled lock + explanation tooltip) can never drift
 * between views for the same in-use constraint.
 *
 * Rendering rules:
 *  - `canDelete === false`      → renders nothing (caller lacks permission).
 *  - `blockedReason` set        → disabled Lock icon + tooltip with the reason
 *                                 (record is in use; action is forbidden).
 *  - otherwise                  → normal trash button; spinner while deleting.
 */

export interface ResourceDeleteButtonProps {
  /** When false, the button is not rendered at all. */
  canDelete: boolean;
  /** When set, render the disabled lock + tooltip explaining the block. */
  blockedReason?: string | undefined;
  /** Invoked on click of the enabled delete button (propagation is stopped). */
  onDelete: () => void;
  /** Resource name used in the accessible label. */
  label?: string | undefined;
  /** When true, the enabled button shows a spinner and is non-interactive. */
  isDeleting?: boolean | undefined;
  /** Extra disable flag for the normal (non-blocked) button. */
  disabled?: boolean | undefined;
}

/** Shared copy for the "record still has products" blocked state (M04-02). */
export function productsAssignedReason(count: number): string {
  return `${count} product${count === 1 ? '' : 's'} assigned — reassign or archive them first`;
}

export function ResourceDeleteButton({
  canDelete,
  blockedReason,
  onDelete,
  label,
  isDeleting = false,
  disabled = false,
}: ResourceDeleteButtonProps) {
  if (!canDelete) return null;

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
              aria-label={`Cannot delete${label ? ` ${label}` : ''}: ${blockedReason}`}
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
        onDelete();
      }}
      disabled={disabled || isDeleting}
      aria-label={`Delete${label ? ` ${label}` : ''}`}
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
