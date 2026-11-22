'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, History, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoms } from '@/hooks/useBom';
import { BomTable } from '@/components/bom/BomTable';
import { BomFormDialog } from '@/components/bom/BomFormDialog';
import { ProductionLogDialog } from '@/components/bom/ProductionLogDialog';
import {
  factoryFeedErrorMessage,
  resolveFactoryFeedState,
} from '@/components/raw-materials/factoryDashboardState';

interface BomListClientProps {
  permissions: string[];
}

export function BomListClient({ permissions }: BomListClientProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // ARGUS #254: the list asked for a fixed 50 rows and had no page controls.
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [produceBomId, setProduceBomId] = useState<string | null>(null);

  const { data, isError, isLoading, error, isFetching, refetch } = useBoms({
    ...(debounced ? { search: debounced } : {}),
    page,
    limit: 25,
  });

  const canCreate = permissions.includes('bom:create');
  const canEdit = permissions.includes('bom:edit');
  const canDelete = permissions.includes('bom:delete');
  const canProduce = permissions.includes('bom:produce');
  const canViewHistory = permissions.includes('bom:production:view');

  const items = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // ARGUS #252 - error outranks empty: a failed list must not claim there are
  // no recipes, and last-known rows are not presented as current.
  const viewState = resolveFactoryFeedState({
    isError,
    isLoading,
    itemCount: items.length,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Bill of Materials</h1>
          <p className="mt-1 font-body text-sm text-mist-ink">
            Define the raw materials consumed to produce each finished good.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canViewHistory && (
            <Button variant="outline" asChild>
              <Link href="/factory/production">
                <History className="mr-2 h-4 w-4" />
                Production history
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by finished product name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            const value = e.target.value;
            window.setTimeout(() => {
              setDebounced(value);
              setPage(1);
            }, 300);
          }}
          className="max-w-sm"
        />
      </div>

      {viewState === 'error' ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center"
        >
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="font-body text-sm font-medium text-red-800">
            Bills of materials could not be loaded
          </p>
          <p className="font-body text-xs text-red-600">
            {factoryFeedErrorMessage(error, 'The list request failed.')}
          </p>
          <p className="font-body text-xs text-red-600">
            No recipes are shown until the list loads. This is not an empty result.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      ) : viewState === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <BomTable
          items={items}
          canEdit={canEdit}
          canDelete={canDelete}
          canProduce={canProduce}
          onEdit={(id) => {
            setEditingBomId(id);
            setFormOpen(true);
          }}
          onProduce={(id) => setProduceBomId(id)}
        />
      )}

      {viewState === 'data' && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="font-body text-mist-ink">
            Page {meta?.page ?? page} of {totalPages} ({meta?.total ?? items.length} recipes)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <BomFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingBomId(null);
        }}
        editingBomId={editingBomId}
      />

      <ProductionLogDialog bomId={produceBomId} onClose={() => setProduceBomId(null)} />
    </div>
  );
}
