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
import type { DeliveryStatus } from '@/generated/prisma/client';

interface OrderFiltersProps {
  search: string;
  status: DeliveryStatus | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: DeliveryStatus | null) => void;
}

export function OrderFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search orders, customers..."
        className="w-72"
      />
      <Select
        value={status ?? '__all'}
        onValueChange={(v) => onStatusChange(v === '__all' ? null : (v as DeliveryStatus))}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All statuses</SelectItem>
          {DELIVERY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, ' ').toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
