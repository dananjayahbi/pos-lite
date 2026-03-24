'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReturnsHistoryTable } from '@/components/returns/ReturnsHistoryTable';

export default function ReturnsManagementPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Returns</h1>
        <p className="mt-1 text-sm text-sand">
          Review refund activity, restocking outcomes, and original sale context outside the POS terminal.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
        <ErrorBoundary>
          <ReturnsHistoryTable />
        </ErrorBoundary>
      </section>
    </div>
  );
}