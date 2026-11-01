'use client';

import { Pencil, Package, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PackagingItemRow } from '@/hooks/delivery/usePackaging';
import { formatPackagingQuantity } from '@/lib/constants/packaging';

interface PackagingStockTableProps {
  items: PackagingItemRow[];
  onAdjust: (item: PackagingItemRow) => void;
  onEdit: (item: PackagingItemRow) => void;
  onDelete: (item: PackagingItemRow) => void;
  canManage: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  POLYMAILER: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  TAPE: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  LABEL: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  BUBBLE_WRAP: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
  OTHER: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

export function PackagingStockTable({
  items,
  onAdjust,
  onEdit,
  onDelete,
  canManage,
}: PackagingStockTableProps) {
  if (items.length === 0) {
    return (
      <div className="border-espresso/20 flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <Package className="text-espresso/30 h-10 w-10" />
        <p className="text-espresso/60 text-sm font-medium">No packaging items yet</p>
        <p className="text-espresso/40 text-xs">
          Add a packaging item to track stock used per parcel.
        </p>
      </div>
    );
  }

  return (
    <div className="border-espresso/10 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-205">
        <thead>
          <tr className="border-espresso/10 bg-espresso/5 border-b">
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">Name</th>
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">Category</th>
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">SKU</th>
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">Unit</th>
            <th className="text-espresso/60 px-4 py-3 text-right text-xs font-medium">On Hand</th>
            <th className="text-espresso/60 px-4 py-3 text-right text-xs font-medium">
              Low Stock At
            </th>
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">Status</th>
            <th className="text-espresso/60 px-4 py-3 text-left text-xs font-medium">
              Auto Deduct
            </th>
            <th className="text-espresso/60 px-4 py-3 text-right text-xs font-medium">
              Per Parcel
            </th>
            <th className="text-espresso/60 px-4 py-3 text-right text-xs font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.quantityOnHand <= item.lowStockThreshold;
            return (
              <tr
                key={item.id}
                className="border-espresso/5 hover:bg-espresso/5 border-b last:border-0"
              >
                <td className="text-espresso px-4 py-3 text-sm font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER}
                  >
                    {item.categoryName ?? item.category}
                  </Badge>
                </td>
                <td className="text-espresso/60 px-4 py-3 font-mono text-xs">{item.sku ?? '—'}</td>
                <td className="text-espresso/60 px-4 py-3 text-sm">{item.unit}</td>
                <td
                  className={`px-4 py-3 text-right text-sm font-semibold ${isLow ? 'text-terracotta' : 'text-espresso'}`}
                >
                  {formatPackagingQuantity(item.quantityOnHand, item.unit)}
                </td>
                <td className="text-espresso/60 px-4 py-3 text-right text-sm">
                  {formatPackagingQuantity(item.lowStockThreshold, item.unit)}
                </td>
                <td className="px-4 py-3">
                  {isLow ? (
                    <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      In Stock
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.autoDeduct ? (
                    <Badge
                      variant="outline"
                      className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100"
                    >
                      Auto
                    </Badge>
                  ) : (
                    <span className="text-espresso/40 text-sm">Manual</span>
                  )}
                </td>
                <td className="text-espresso/60 px-4 py-3 text-right text-sm">
                  {item.consumptionPerParcel != null ? Number(item.consumptionPerParcel) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => onAdjust(item)}>
                      Adjust
                    </Button>
                    {canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit item"
                          onClick={() => onEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          title="Delete item"
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
