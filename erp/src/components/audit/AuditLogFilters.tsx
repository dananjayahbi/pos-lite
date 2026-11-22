'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAuditActionLabel } from '@/lib/audit/auditPresentation.core';
import {
  DEFAULT_AUDIT_FILTERS,
  MAX_AUDIT_SEARCH_LENGTH,
  type AuditLogFilterStateLike,
} from '@/lib/audit/auditFilterState.core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditLogFilterState = AuditLogFilterStateLike;

interface AuditLogFiltersProps {
  value: AuditLogFilterState;
  onFilterChange: (filters: AuditLogFilterState) => void;
  /** Distinct values actually present in the ledger (ARGUS #451). */
  entityTypes?: Array<{ value: string; count: number }> | undefined;
  actions?: Array<{ value: string; count: number }> | undefined;
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
  'STAFF_CREATED',
  'STAFF_UPDATED',
  'STAFF_DEACTIVATED',
  'STAFF_REACTIVATED',
  'STAFF_COMMISSION_RATE_CHANGED',
  'STAFF_ROLE_CHANGED',
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

export default function AuditLogFilters({
  value,
  onFilterChange,
  entityTypes,
  actions,
}: AuditLogFiltersProps) {
  const [local, setLocal] = useState<AuditLogFilterState>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const entityOptions =
    entityTypes && entityTypes.length > 0
      ? entityTypes
      : ENTITY_TYPES.map((entityType) => ({ value: entityType, count: 0 }));
  const actionOptions =
    actions && actions.length > 0
      ? actions
      : ACTIONS.map((action) => ({ value: action, count: 0 }));

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onFilterChange(local);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [local, onFilterChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Free-text / entity-id investigation search (ARGUS #457). */}
      <div className="w-full sm:max-w-md">
        <Label htmlFor="audit-search" className="text-sm text-sand-ink">
          Search
        </Label>
        <Input
          id="audit-search"
          type="search"
          placeholder="Entity ID, entity type, action, IP or user agent"
          value={local.search}
          maxLength={MAX_AUDIT_SEARCH_LENGTH}
          onChange={(event) => setLocal((s) => ({ ...s, search: event.target.value }))}
          className="border-mist"
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      {/* Entity Type */}
      <div className="w-full sm:w-48">
        <Label className="text-sm text-sand-ink">Entity Type</Label>
        <Select
          value={local.entityType}
          onValueChange={(v) => setLocal((s) => ({ ...s, entityType: v }))}
        >
          <SelectTrigger className="border-mist">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {entityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.value.replace(/([a-z])([A-Z])/g, '$1 $2')}
                {option.count > 0 ? ` (${option.count})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-56">
        <Label className="text-sm text-sand-ink">Action</Label>
        <Select
          value={local.action}
          onValueChange={(v) => setLocal((s) => ({ ...s, action: v }))}
        >
          <SelectTrigger className="border-mist">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {actionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {/* Same title case as the table and detail modal (ARGUS #457). */}
                {formatAuditActionLabel(option.value)}
                {option.count > 0 ? ` (${option.count})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="w-full sm:w-40">
        <Label className="text-sm text-sand-ink">From</Label>
        <Input
          type="date"
          value={local.startDate}
          onChange={(e) => setLocal((s) => ({ ...s, startDate: e.target.value }))}
          className="border-mist"
        />
      </div>

      {/* Date To */}
      <div className="w-full sm:w-40">
        <Label className="text-sm text-sand-ink">To</Label>
        <Input
          type="date"
          value={local.endDate}
          onChange={(e) => setLocal((s) => ({ ...s, endDate: e.target.value }))}
          className="border-mist"
        />
      </div>

      {/* Actor (userId) */}
      <div className="w-full sm:w-52">
        <Label className="text-sm text-sand-ink">Actor ID</Label>
        <Input
          type="text"
          placeholder="All Users"
          value={local.userId}
          onChange={(e) => setLocal((s) => ({ ...s, userId: e.target.value }))}
          className="border-mist"
        />
        <p className="mt-1 text-[10px] leading-tight text-sand-ink">
          Paste the Actor ID shown in an entry&apos;s detail.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="sm:mb-0"
        onClick={() => setLocal({ ...DEFAULT_AUDIT_FILTERS })}
      >
        Clear Filters
      </Button>
      </div>
    </div>
  );
}
