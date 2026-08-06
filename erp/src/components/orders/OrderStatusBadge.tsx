import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-800',
  PENDING_DISPATCH: 'bg-amber-100 text-amber-800',
  HOLD: 'bg-orange-100 text-orange-800',
  DISPATCHED: 'bg-indigo-100 text-indigo-800',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELED: 'bg-zinc-200 text-zinc-700',
  RETURNED: 'bg-rose-100 text-rose-800',
  PENDING_PICKUP: 'bg-teal-100 text-teal-800',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-linen text-espresso/60',
      )}
    >
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}
