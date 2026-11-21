'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import AuditLogFilters from '@/components/audit/AuditLogFilters';
import AuditLogTable from '@/components/audit/AuditLogTable';
import type { AuditLogFilterState } from '@/components/audit/AuditLogFilters';
import {
  auditFiltersFromParams,
  auditFiltersToQuery,
} from '@/lib/audit/auditFilterState.core';

interface FacetOption {
  value: string;
  count: number;
}

interface AuditFacetsResponse {
  success: boolean;
  data: { entityTypes: FacetOption[]; actions: FacetOption[] };
}

export default function AuditLogPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ARGUS #457 - a filtered investigation is bookmarkable/shareable.
  const [filters, setFilters] = useState<AuditLogFilterState>(() =>
    auditFiltersFromParams(new URLSearchParams(searchParams.toString())),
  );

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

  const handleFilterChange = useCallback(
    (next: AuditLogFilterState) => {
      setFilters(next);
      const query = auditFiltersToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

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
