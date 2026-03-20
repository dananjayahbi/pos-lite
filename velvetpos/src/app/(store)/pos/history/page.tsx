'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SaleHistoryTable } from '@/components/pos/SaleHistoryTable';

export default function SaleHistoryPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-mist/30 bg-linen">
        <Link
          href="/pos"
          className="flex items-center gap-1 text-terracotta hover:text-espresso transition-colors font-body text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-lg text-espresso">Sale History</h1>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <SaleHistoryTable />
      </div>
    </div>
  );
}
