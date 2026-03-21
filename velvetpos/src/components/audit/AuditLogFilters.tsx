'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogFilterState {
  entityType: string;
  startDate: string;
  endDate: string;
  userId: string;
}

interface AuditLogFiltersProps {
  value: AuditLogFilterState;
  onFilterChange: (filters: AuditLogFilterState) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  'Sale',
  'Return',
  'Customer',
  'StockAdjustment',
  'Promotion',
  'Staff',
  'Expense',
  'Shift',
  'Settings',
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogFilters({ value, onFilterChange }: AuditLogFiltersProps) {
  const [local, setLocal] = useState<AuditLogFilterState>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onFilterChange(local);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [local, onFilterChange]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      {/* Entity Type */}
      <div className="w-full sm:w-48">
        <Label className="text-sm text-sand">Entity Type</Label>
        <Select
          value={local.entityType}
          onValueChange={(v) => setLocal((s) => ({ ...s, entityType: v }))}
        >
          <SelectTrigger className="border-mist">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/([a-z])([A-Z])/g, '$1 $2')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="w-full sm:w-40">
        <Label className="text-sm text-sand">From</Label>
        <Input
          type="date"
          value={local.startDate}
          onChange={(e) => setLocal((s) => ({ ...s, startDate: e.target.value }))}
          className="border-mist"
        />
      </div>

      {/* Date To */}
      <div className="w-full sm:w-40">
        <Label className="text-sm text-sand">To</Label>
        <Input
          type="date"
          value={local.endDate}
          onChange={(e) => setLocal((s) => ({ ...s, endDate: e.target.value }))}
          className="border-mist"
        />
      </div>

      {/* Actor (userId) */}
      <div className="w-full sm:w-52">
        <Label className="text-sm text-sand">User ID</Label>
        <Input
          type="text"
          placeholder="All Users"
          value={local.userId}
          onChange={(e) => setLocal((s) => ({ ...s, userId: e.target.value }))}
          className="border-mist"
        />
      </div>
    </div>
  );
}
