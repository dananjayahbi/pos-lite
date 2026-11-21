'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AuditLogFilters from '@/components/audit/AuditLogFilters';
import AuditLogTable from '@/components/audit/AuditLogTable';
import type { AuditLogFilterState } from '@/components/audit/AuditLogFilters';

interface FacetOption {
  value: string;
  count: number;
}

interface AuditFacetsResponse {
  success: boolean;
  data: { entityTypes: FacetOption[]; actions: FacetOption[] };
}

const DEFAULT_FILTERS: AuditLogFilterState = {
  entityType: 'ALL',
  action: 'ALL',
  startDate: '',
  endDate: '',
  userId: '',
};

export default function AuditLogPageClient() {
  const [filters, setFilters] = useState<AuditLogFilterState>(DEFAULT_FILTERS);

  // Populate the filter menus from the ledger's actual vocabulary (ARGUS #451).
  const { data: facetsData } = useQuery<AuditFacetsResponse>({
    queryKey: ['audit-log-facets'],
    queryFn: async () => {
      const res = await fetch('/api/audit-logs/facets');
      if (!res.ok) throw new Error('Failed to load audit filters');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleFilterChange = useCallback((next: AuditLogFilterState) => {
    setFilters(next);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-2xl font-bold text-espresso">Audit Log</h1>
      <AuditLogFilters
        value={filters}
        onFilterChange={handleFilterChange}
        entityTypes={facetsData?.data.entityTypes}
        actions={facetsData?.data.actions}
      />
      <AuditLogTable filters={filters} />
    </div>
  );
}
