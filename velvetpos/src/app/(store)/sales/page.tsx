'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SaleHistoryTable } from '@/components/pos/SaleHistoryTable';

export default function SalesManagementPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Sales</h1>
        <p className="mt-1 text-sm text-sand">
          Review completed, held, and voided sales outside the POS terminal.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
        <ErrorBoundary>
          <SaleHistoryTable />
        </ErrorBoundary>
      </section>
    </div>
  );
}