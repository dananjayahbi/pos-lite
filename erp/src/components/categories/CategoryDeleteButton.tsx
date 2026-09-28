'use client';

import { ResourceDeleteButton } from '@/components/shared/ResourceDeleteButton';

interface CategoryDeleteButtonProps {
  isDeleting: boolean;
  disabled?: boolean | undefined;
  onClick: () => void;
  categoryName: string;
  /** When set, render as a disabled lock icon with an explanation tooltip. */
  blockedReason?: string | undefined;
}

/**
 * M04-02 — thin back-compat wrapper over the shared ResourceDeleteButton so
 * category and brand views can never drift apart. New call sites should use
 * `ResourceDeleteButton` directly.
 */
export function CategoryDeleteButton({
  isDeleting,
  disabled,
  onClick,
  categoryName,
  blockedReason,
}: CategoryDeleteButtonProps) {
  return (
    <ResourceDeleteButton
      canDelete
      label={categoryName}
      blockedReason={blockedReason}
      isDeleting={isDeleting}
      disabled={disabled}
      onDelete={onClick}
    />
  );
}
