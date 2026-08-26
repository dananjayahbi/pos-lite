'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SaleHistoryTable } from '@/components/pos/SaleHistoryTable';
import { NewSaleSheet } from '@/components/sales/NewSaleSheet';

export default function SalesManagementPageClient() {
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">Sales</h1>
          <p className="text-sand mt-1 text-sm">
            Review completed, held, and voided sales outside the POS terminal.
          </p>
        </div>
        <Button
          onClick={() => setSaleSheetOpen(true)}
          className="bg-espresso text-pearl hover:bg-espresso/90 shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Sale
        </Button>
      </div>

      <section className="border-mist/60 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <ErrorBoundary>
          <SaleHistoryTable />
        </ErrorBoundary>
      </section>

      <NewSaleSheet open={saleSheetOpen} onOpenChange={setSaleSheetOpen} />
    </div>
  );
}
