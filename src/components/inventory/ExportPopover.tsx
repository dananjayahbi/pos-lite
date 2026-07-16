'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useInventorySelectionStore } from '@/stores/inventorySelectionStore';

interface ExportPopoverProps {
  permissions: string[];
  totalCount: number;
  activeFilters: Record<string, string | undefined>;
}

export function ExportPopover({ permissions, totalCount, activeFilters }: ExportPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'visible' | 'selected'>('visible');
  const [includeCost, setIncludeCost] = useState(false);
  const selectedProductIds = useInventorySelectionStore((s) => s.selectedProductIds);

  const hasFilters = Object.values(activeFilters).some(Boolean);
  const selectionCount = selectedProductIds.size;

  const handleDownload = () => {
    setOpen(false);
    toast.loading('Generating export…', { id: 'export' });

    const params = new URLSearchParams();

    if (mode === 'visible') {
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value) params.set(key, value);
      }
    } else {
      params.set('productIds', Array.from(selectedProductIds).join(','));
    }

    if (includeCost) {
      params.set('include_cost_prices', 'true');
    }

    const url = `/api/store/products/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      toast.success('Download started', { id: 'export', duration: 2000 });
    }, 1500);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-sand text-espresso">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <p className="font-display text-sm font-medium text-espresso">Export Products</p>

          {/* Option 1: Export visible */}
          <button
            type="button"
            onClick={() => setMode('visible')}
            className={`w-full rounded-md px-3 py-2 text-left font-body text-sm text-espresso transition-colors hover:bg-sand/10 ${
              mode === 'visible' ? 'border border-sand bg-sand/20' : ''
            }`}
          >
            {hasFilters
              ? `Export visible products (${totalCount})`
              : `Export all products (${totalCount} total)`}
          </button>

          {/* Option 2: Export selected */}
          {selectionCount > 0 ? (
            <button
              type="button"
              onClick={() => setMode('selected')}
              className={`w-full rounded-md px-3 py-2 text-left font-body text-sm text-espresso transition-colors hover:bg-sand/10 ${
                mode === 'selected' ? 'border border-sand bg-sand/20' : ''
              }`}
            >
              Export selected products ({selectionCount} selected)
            </button>
          ) : (
            <div
              className="w-full rounded-md px-3 py-2 text-left font-body text-sm text-mist cursor-not-allowed"
              title="Select products first"
            >
              Export selected products (0 selected)
            </div>
          )}

          {/* Cost price checkbox */}
          {permissions.includes('product:view_cost_price') && (
            <div className="flex items-center gap-2 px-3">
              <Checkbox
                id="include-cost"
                checked={includeCost}
                onCheckedChange={(checked) => setIncludeCost(checked === true)}
              />
              <label
                htmlFor="include-cost"
                className="font-body text-sm text-espresso cursor-pointer"
              >
                Include cost prices
              </label>
            </div>
          )}

          {/* Download */}
          <Button
            className="w-full bg-espresso text-pearl hover:bg-espresso/90"
            onClick={handleDownload}
          >
            Download
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
