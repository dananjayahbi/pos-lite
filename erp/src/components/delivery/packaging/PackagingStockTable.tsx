'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';

interface PackagingItem {
  id: string;
  name: string;
  category: string;
  sku?: string | null;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  autoDeduct: boolean;
  consumptionPerParcel?: number | string | null;
}

interface PackagingStockTableProps {
  items: PackagingItem[];
  onAdjust: (item: PackagingItem) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  POLYMAILER: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  TAPE: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  LABEL: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  BUBBLE_WRAP: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
  OTHER: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const CATEGORY_LABELS: Record<string, string> = {
  POLYMAILER: 'Polymailer',
  TAPE: 'Tape',
  LABEL: 'Label',
  BUBBLE_WRAP: 'Bubble Wrap',
  OTHER: 'Other',
};

export function PackagingStockTable({ items, onAdjust }: PackagingStockTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-espresso/20 py-12 text-center">
        <Package className="h-10 w-10 text-espresso/30" />
        <p className="text-sm font-medium text-espresso/60">No packaging items yet</p>
        <p className="text-xs text-espresso/40">
          Add a packaging item to track stock used per parcel.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-espresso/10">
      <table className="w-full min-w-205">
        <thead>
          <tr className="border-b border-espresso/10 bg-espresso/5">
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Category</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">SKU</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Unit</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">On Hand</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Low Stock At</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Auto Deduct</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Per Parcel</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.quantityOnHand <= item.lowStockThreshold;
            return (
              <tr key={item.id} className="border-b border-espresso/5 last:border-0 hover:bg-espresso/5">
                <td className="px-4 py-3 text-sm font-medium text-espresso">{item.name}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-espresso/60">
                  {item.sku ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-espresso/60">{item.unit}</td>
                <td
                  className={`px-4 py-3 text-right text-sm font-semibold ${isLow ? 'text-terracotta' : 'text-espresso'}`}
                >
                  {item.quantityOnHand}
                </td>
                <td className="px-4 py-3 text-right text-sm text-espresso/60">
                  {item.lowStockThreshold}
                </td>
                <td className="px-4 py-3">
                  {isLow ? (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-800 hover:bg-red-100"
                    >
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                      In Stock
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.autoDeduct ? (
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                      Auto
                    </Badge>
                  ) : (
                    <span className="text-sm text-espresso/40">Manual</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-espresso/60">
                  {item.consumptionPerParcel != null ? Number(item.consumptionPerParcel) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => onAdjust(item)}>
                    Adjust
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
