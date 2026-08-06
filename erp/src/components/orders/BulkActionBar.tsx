'use client';

import { Button } from '@/components/ui/button';
import { Printer, Package, Tag } from 'lucide-react';

interface BulkActionBarProps {
  count: number;
  canEdit: boolean;
  canDispatch: boolean;
  onStatusChange: () => void;
  onCreateDelivery: () => void;
  onPrint: () => void;
}

export function BulkActionBar({
  count,
  canEdit,
  canDispatch,
  onStatusChange,
  onCreateDelivery,
  onPrint,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-espresso/10 bg-pearl px-4 py-2.5">
      <span className="text-sm font-medium text-espresso">{count} selected</span>
      {canEdit && (
        <Button size="sm" variant="outline" onClick={onStatusChange}>
          <Tag className="mr-1.5 h-4 w-4" />
          Change status
        </Button>
      )}
      {canDispatch && (
        <Button size="sm" variant="outline" onClick={onCreateDelivery}>
          <Package className="mr-1.5 h-4 w-4" />
          Prepare for delivery
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onPrint}>
        <Printer className="mr-1.5 h-4 w-4" />
        Print labels
      </Button>
    </div>
  );
}
