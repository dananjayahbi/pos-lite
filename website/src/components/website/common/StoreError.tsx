'use client';

import React from 'react';
import { TenantError } from '@/components/website/common/TenantError';

interface StoreErrorProps {
  error?: Error & { digest?: string } | undefined;
  reset: () => void;
  /** Tenant slug used for the "Go Home" link. */
  tenantSlug?: string | undefined;
}

/**
 * Shared "Something went wrong" error page for a tenant storefront. Renders a
 * friendly recovery UI with a "Try Again" retry action and a "Go Home" link,
 * plus the optional error digest for support. Purely presentational — the
 * caller (an error boundary) supplies `error` + `reset`.
 */
export function StoreError({ error, reset, tenantSlug }: StoreErrorProps) {
  return (
    <TenantError
      title="Something went wrong"
      message="We couldn't load this storefront right now. Please try again in a moment."
      onRetry={reset}
      digest={error?.digest}
      tenantSlug={tenantSlug}
    />
  );
}
