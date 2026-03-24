'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CustomerImportPanel } from '@/components/customers/CustomerImportPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CustomerImportPage() {
  const queryClient = useQueryClient();

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Import Customers</h1>
          <p className="mt-1 text-sm text-sand">
            Bulk upload customer records with the same CSV endpoint used by the sheet workflow,
            now with a full-page view that is easier to revisit and explain to staff.
          </p>
        </div>

        <CustomerImportPanel
          showBackLink
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
