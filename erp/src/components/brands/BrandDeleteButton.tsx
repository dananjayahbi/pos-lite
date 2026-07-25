'use client';

import { Loader2, Trash2 } from 'lucide-react';

interface BrandDeleteButtonProps {
  isDeleting?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  brandName: string;
}

export function BrandDeleteButton({
  isDeleting,
  disabled,
  onClick,
  brandName,
}: BrandDeleteButtonProps) {
  return (
    <button
      type="button"
      className="rounded p-1 text-danger/80 transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled || isDeleting}
      aria-label={`Delete ${brandName}`}
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
