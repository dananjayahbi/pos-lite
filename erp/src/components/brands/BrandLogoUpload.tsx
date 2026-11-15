'use client';

import { LogoUploadField } from '@/components/shared/LogoUploadField';

interface BrandLogoUploadProps {
  /** Current logo URL (if any). */
  logoUrl: string | null;
  /** Called when a new logo URL is available. */
  onChange: (url: string | null) => void;
  /** Disable all interactions. */
  disabled?: boolean | undefined;
}

/** Brand-scoped wrapper around the shared logo uploader. */
export function BrandLogoUpload({ logoUrl, onChange, disabled }: BrandLogoUploadProps) {
  return (
    <LogoUploadField
      logoUrl={logoUrl}
      onChange={onChange}
      uploadUrl="/api/store/upload/brand-logo"
      alt="Brand logo"
      {...(disabled !== undefined ? { disabled } : {})}
    />
  );
}
