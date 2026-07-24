'use client';

import { ProductGrid } from '@/components/pos/ProductGrid';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function POSPage() {
  return (
    <ErrorBoundary>
      <ProductGrid />
    </ErrorBoundary>
  );
}
