'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
  action: string;
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

const ACTIONS = [
  'SALE_COMPLETED',
  'SALE_VOIDED',
  'RETURN_COMPLETED',
  'CUSTOMER_CREDIT_ADJUSTED',
  'PO_STATUS_CHANGED',
  'STAFF_ROLE_CHANGED',
  'STAFF_PIN_CHANGED',
  'STAFF_PERMISSION_CHANGED',
  'PROMOTION_CREATED',
  'PROMOTION_UPDATED',
  'PROMOTION_ARCHIVED',
  'STOCK_ADJUSTED',
  'EXPENSE_CREATED',
  'EXPENSE_DELETED',
  'SHIFT_CLOSED',
  'COMMISSION_PAYOUT_CREATED',
  'SETTINGS_CHANGED',
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

      <div className="w-full sm:w-56">
        <Label className="text-sm text-sand">Action</Label>
        <Select
          value={local.action}
          onValueChange={(v) => setLocal((s) => ({ ...s, action: v }))}
        >
          <SelectTrigger className="border-mist">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action.replace(/_/g, ' ')}
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
        <Label className="text-sm text-sand">Actor ID</Label>
        <Input
          type="text"
          placeholder="All Users"
          value={local.userId}
          onChange={(e) => setLocal((s) => ({ ...s, userId: e.target.value }))}
          className="border-mist"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="sm:mb-0"
        onClick={() => setLocal({ entityType: 'ALL', action: 'ALL', startDate: '', endDate: '', userId: '' })}
      >
        Clear Filters
      </Button>
    </div>
  );
}
