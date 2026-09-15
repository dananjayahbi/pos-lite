'use client';

import { ResourceDeleteButton } from '@/components/shared/ResourceDeleteButton';

interface BrandDeleteButtonProps {
  isDeleting?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick: () => void;
  brandName: string;
  /** When set, render as a disabled lock icon with an explanation tooltip (M04-02). */
  blockedReason?: string | undefined;
}

/**
 * M04-02 — thin back-compat wrapper over the shared ResourceDeleteButton so
 * brands get the same blocked affordance (disabled lock + tooltip) as
 * categories. New call sites should use `ResourceDeleteButton` directly.
 */
export function BrandDeleteButton({
  isDeleting,
  disabled,
  onClick,
  brandName,
  blockedReason,
}: BrandDeleteButtonProps) {
  return (
    <ResourceDeleteButton
      canDelete
      label={brandName}
      blockedReason={blockedReason}
      isDeleting={isDeleting}
      disabled={disabled}
      onDelete={onClick}
    />
  );
}
