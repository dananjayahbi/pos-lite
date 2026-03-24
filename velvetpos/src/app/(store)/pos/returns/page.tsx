'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReturnsHistoryTable } from '@/components/returns/ReturnsHistoryTable';

export default function ReturnHistoryPage() {

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-mist/30 bg-linen px-4 py-3">
        <Link
          href="/pos"
          className="flex items-center gap-1 font-body text-sm text-terracotta transition-colors hover:text-espresso"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-lg text-espresso">Return History</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ReturnsHistoryTable />
      </div>
    </div>
  );
}
