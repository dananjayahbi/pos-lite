'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Upload, Download } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { BulkActionBar } from '@/components/inventory/BulkActionBar';
import { ExportPopover } from '@/components/inventory/ExportPopover';
import { InventoryFilterBar } from '@/components/inventory/InventoryFilterBar';
import { ActiveFilterChips } from '@/components/inventory/ActiveFilterChips';
import { useProducts } from '@/hooks/useProducts';
import { LowStockAlertBadge } from '@/components/stock/LowStockAlertBadge';

interface InventoryListClientProps {
  initialCount: number;
  permissions: string[];
}

export function InventoryListClient({ initialCount, permissions }: InventoryListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '25');
  const search = searchParams.get('search') ?? undefined;
  const categories = searchParams.get('categories') ?? undefined;
  const brands = searchParams.get('brands') ?? undefined;
  const genders = searchParams.get('genders') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  const filters = useMemo(
    () => ({ search, categories, brands, genders, status, page, limit }),
    [search, categories, brands, genders, status, page, limit],
  );

  const hasActiveFilters = !!(search || categories || brands || genders || status);

  const { data, isLoading } = useProducts(filters);

  const displayCount = data?.meta?.total ?? initialCount;
  const totalPages = data?.meta?.totalPages ?? Math.ceil(initialCount / limit);
  const products = data?.data ?? [];

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.push(`/inventory?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleClearFilters = useCallback(() => {
    router.push('/inventory');
  }, [router]);

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const res = await fetch(`/api/store/products/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error('Failed to update archive status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
  });

  const handleArchive = useCallback(
    (id: string, archive: boolean) => {
      archiveMutation.mutate({ id, archive });
    },
    [archiveMutation],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget);
  }, [deleteTarget, deleteMutation]);

  // Pagination
  const showFrom = (page - 1) * limit + 1;
  const showTo = Math.min(page * limit, displayCount);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-espresso">Inventory</h1>
          <p className="font-body text-sm text-mist">
            {displayCount} {displayCount === 1 ? 'product' : 'products'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportPopover
            permissions={permissions}
            totalCount={displayCount}
            activeFilters={{ search, categories, brands, genders, status }}
          />
          {permissions.includes('product:import') && (
            <Button variant="outline" className="border-sand text-espresso" asChild>
              <Link href="/inventory/import">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Link>
            </Button>
          )}
          {permissions.includes('product:create') && (
            <Button asChild className="bg-espresso text-pearl hover:bg-espresso/90">
              <Link href="/inventory/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      <LowStockAlertBadge />

      {/* Filters */}
      <InventoryFilterBar totalCount={displayCount} />
      <ActiveFilterChips />

      {/* Table */}
      <InventoryTable
        products={products}
        isLoading={isLoading}
        permissions={permissions}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {displayCount > limit && (
        <div className="flex items-center justify-between border-t border-sand/20 pt-4">
          <p className="font-body text-sm text-mist">
            Showing {showFrom}–{showTo} of {displayCount} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= page - 1 && p <= page + 1),
              )
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-1 text-mist">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? 'default' : 'outline'}
                    size="sm"
                    className={
                      item === page
                        ? 'bg-espresso text-pearl'
                        : 'border-sand text-espresso'
                    }
                    onClick={() => updateParams({ page: String(item) })}
                  >
                    {item}
                  </Button>
                ),
              )}
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      <BulkActionBar permissions={permissions} />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Delete Product</DialogTitle>
            <DialogDescription className="font-body text-mist">
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
