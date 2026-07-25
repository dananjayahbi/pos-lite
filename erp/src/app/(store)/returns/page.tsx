'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReturnsHistoryTable } from '@/components/returns/ReturnsHistoryTable';
import { NewReturnSheet } from '@/components/returns/NewReturnSheet';

export default function ReturnsManagementPage() {
  const [returnSheetOpen, setReturnSheetOpen] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Returns</h1>
          <p className="mt-1 text-sm text-sand">
            Review refund activity, restocking outcomes, and original sale context outside the POS terminal.
          </p>
        </div>
        <Button
          onClick={() => setReturnSheetOpen(true)}
          className="shrink-0 bg-espresso text-pearl hover:bg-espresso/90"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Process Return
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
        <ErrorBoundary>
          <ReturnsHistoryTable />
        </ErrorBoundary>
      </section>

      <NewReturnSheet
        open={returnSheetOpen}
        onOpenChange={setReturnSheetOpen}
      />
    </div>
  );
}