'use client';

import { Button } from '@/components/ui/button';
import { formatRupee } from '@/lib/format';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { DeliveryListItem } from '@/types/delivery';

interface OrdersTableProps {
  orders: DeliveryListItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onView: (id: string) => void;
  onPrint: (order: DeliveryListItem) => void;
  onPrintInvoice: (order: DeliveryListItem) => void;
}

export function OrdersTable({
  orders,
  selectedIds,
  onToggle,
  onToggleAll,
  onView,
  onPrint,
  onPrintInvoice,
}: OrdersTableProps) {
  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-espresso/10">
      <table className="w-full">
        <thead>
          <tr className="border-b border-espresso/10 bg-espresso/5">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-4 w-4 accent-espresso"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Order Ref</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">City</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Items</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">COD</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const shipment = order.shipments?.[0];
            const waybill = order.waybill ?? shipment?.waybillId;
            return (
              <tr key={order.id} className="border-b border-espresso/5 hover:bg-espresso/5 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${order.orderRef}`}
                    checked={selectedIds.has(order.id)}
                    onChange={() => onToggle(order.id)}
                    className="h-4 w-4 accent-espresso"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-espresso">{order.orderRef}</td>
                <td className="px-4 py-3 text-sm text-espresso">
                  {order.customer?.name ?? order.address?.fullName ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-espresso/60">{order.address?.cityName ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-espresso/60">{order.itemCount ?? 1}</td>
                <td className="px-4 py-3 text-sm text-espresso">{formatRupee(order.codAmount ?? 0)}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                  {waybill && <p className="mt-0.5 text-xs text-espresso/40">{waybill}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onView(order.id)}>
                      View
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPrint(order)}>
                      Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPrintInvoice(order)}>
                      Invoice
                    </Button>
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
