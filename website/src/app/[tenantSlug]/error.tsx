'use client';

import { useParams } from 'next/navigation';
import { StoreError } from '@/components/website/common/StoreError';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for a single tenant storefront. Shown when the ERP
 * API is unreachable or returns invalid data. Renders the shared
 * "Something went wrong" recovery UI, keeping the tenant-aware home link.
 */
export default function StorefrontError({ error, reset }: ErrorProps) {
  const params = useParams<{ tenantSlug: string }>();
  const slug = params?.tenantSlug;

  return <StoreError error={error} reset={reset} tenantSlug={slug} />;
}