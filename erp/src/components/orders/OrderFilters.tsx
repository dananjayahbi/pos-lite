'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DELIVERY_STATUSES } from '@/lib/validators/delivery.validators';
import {
  dispatchQueueLabel,
  type DispatchStatusSelection,
} from './dispatchQueue';

interface OrderFiltersProps {
  search: string;
  /** `'queue'` is the dispatch-focused default; `null` means all statuses. */
  selection: DispatchStatusSelection;
  /** Per-status workload counts for the current search (ARGUS #269). */
  counts?: Record<string, number> | undefined;
  onSearchChange: (value: string) => void;
  onSelectionChange: (value: DispatchStatusSelection) => void;
}

function withCount(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label} (${count})`;
}

export function OrderFilters({
  search,
  selection,
  counts,
  onSearchChange,
  onSelectionChange,
}: OrderFiltersProps) {
  const queueCount =
    (counts?.PLACED ?? 0) + (counts?.PENDING_DISPATCH ?? 0);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search orders, customers, phone, waybills..."
        className="w-72"
      />
      <Select
        value={selection ?? '__all'}
        onValueChange={(v) => {
          if (v === '__all') onSelectionChange(null);
          else if (v === 'queue') onSelectionChange('queue');
          else onSelectionChange(v as Exclude<DispatchStatusSelection, 'queue' | null>);
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Dispatch queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="queue">
            {counts === undefined ? 'Dispatch queue' : dispatchQueueLabel(queueCount)}
          </SelectItem>
          <SelectItem value="__all">All statuses</SelectItem>
          {DELIVERY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {withCount(s.replace(/_/g, ' ').toLowerCase(), counts?.[s])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {counts && counts.DELIVERED !== undefined && (
        <span className="font-body text-xs text-espresso/60">
          {counts.DELIVERED} delivered · {counts.CANCELED ?? 0} canceled
        </span>
      )}
    </div>
  );
}
