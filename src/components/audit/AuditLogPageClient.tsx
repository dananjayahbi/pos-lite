'use client';

import { useState, useCallback } from 'react';
import AuditLogFilters from '@/components/audit/AuditLogFilters';
import AuditLogTable from '@/components/audit/AuditLogTable';
import type { AuditLogFilterState } from '@/components/audit/AuditLogFilters';

const DEFAULT_FILTERS: AuditLogFilterState = {
  entityType: 'ALL',
  action: 'ALL',
  startDate: '',
  endDate: '',
  userId: '',
};

export default function AuditLogPageClient() {
  const [filters, setFilters] = useState<AuditLogFilterState>(DEFAULT_FILTERS);

  const handleFilterChange = useCallback((next: AuditLogFilterState) => {
    setFilters(next);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-2xl font-bold text-espresso">Audit Log</h1>
      <AuditLogFilters value={filters} onFilterChange={handleFilterChange} />
      <AuditLogTable filters={filters} />
    </div>
  );
}
