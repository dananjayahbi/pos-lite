'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useInventorySelectionStore } from '@/stores/inventorySelectionStore';
import { Button } from '@/components/ui/button';
import { BulkPriceUpdateDialog } from './BulkPriceUpdateDialog';
import {
  BarcodeLabelDialog,
  type LabelVariant,
} from './BarcodeLabelDialog';

interface BulkActionBarProps {
  permissions: string[];
}

export function BulkActionBar({ permissions }: BulkActionBarProps) {
  const selectedIds = useInventorySelectionStore((s) => s.selectedProductIds);
  const clearSelection = useInventorySelectionStore((s) => s.clearSelection);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelVariants, setLabelVariants] = useState<LabelVariant[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  if (selectedIds.size === 0) return null;

  const count = selectedIds.size;
  const canEdit = permissions.includes('product:edit');

  const handlePrintLabels = async () => {
    setLoadingLabels(true);
    try {
      const res = await fetch('/api/store/products/bulk-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Failed to fetch variants');
      const json = await res.json();
      const variants = (json.data ?? []).map(
        (v: {
          id: string;
          sku: string;
          barcode: string | null;
          size: string | null;
          colour: string | null;
          retailPrice: string | number;
          stockQuantity: number;
          lowStockThreshold: number;
          product: { name: string; brand: { name: string } | null };
        }): LabelVariant => ({
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          size: v.size,
          colour: v.colour,
          retailPrice:
            typeof v.retailPrice === 'string'
              ? parseFloat(v.retailPrice)
              : v.retailPrice,
          stockQuantity: v.stockQuantity,
          lowStockThreshold: v.lowStockThreshold,
          brandName: v.product.brand?.name ?? null,
          productName: v.product.name,
        }),
      );
      if (variants.length === 0) {
        toast.info('No variants found for the selected products.');
        return;
      }
      setLabelVariants(variants);
      setLabelDialogOpen(true);
    } catch {
      toast.error('Failed to load variants for label printing.');
    } finally {
      setLoadingLabels(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <div className="bg-espresso border-l border-r border-sand">
          <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 py-3">
            <span className="text-pearl font-body font-medium">
              {count} product{count !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
              {canEdit && (
                <Button
                  variant="outline"
                  className="border-pearl text-pearl hover:bg-pearl/10"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Bulk Price Update
                </Button>
              )}
              <Button
                variant="outline"
                className="border-pearl text-pearl hover:bg-pearl/10"
                disabled={loadingLabels}
                onClick={handlePrintLabels}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                {loadingLabels ? 'Loading…' : 'Print Labels'}
              </Button>
              <Button
                variant="outline"
                className="border-sand text-espresso bg-sand/20 hover:bg-sand/40"
                onClick={() => {
                  const ids = Array.from(selectedIds).join(',');
                  const url = `/api/store/products/export?productIds=${encodeURIComponent(ids)}`;
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = '';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  toast.success('Download started', { duration: 2000 });
                }}
              >
                Export Selected
              </Button>
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      </div>
      {isDialogOpen && (
        <BulkPriceUpdateDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          selectedProductIds={Array.from(selectedIds)}
        />
      )}
      {labelDialogOpen && (
        <BarcodeLabelDialog
          isOpen={labelDialogOpen}
          onClose={() => setLabelDialogOpen(false)}
          variants={labelVariants}
        />
      )}
    </>
  );
}
