'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SaleHistoryTable } from '@/components/pos/SaleHistoryTable';
import { NewSaleSheet } from '@/components/sales/NewSaleSheet';

export default function SalesManagementPage() {
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Sales</h1>
          <p className="mt-1 text-sm text-sand">
            Review completed, held, and voided sales outside the POS terminal.
          </p>
        </div>
        <Button
          onClick={() => setSaleSheetOpen(true)}
          className="shrink-0 bg-espresso text-pearl hover:bg-espresso/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Sale
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
        <ErrorBoundary>
          <SaleHistoryTable />
        </ErrorBoundary>
      </section>

      <NewSaleSheet
        open={saleSheetOpen}
        onOpenChange={setSaleSheetOpen}
      />
    </div>
  );
}