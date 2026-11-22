'use client';

import { useState } from 'react';

import { usePackaging, type PackagingItemRow } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Settings2, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { formatPackagingQuantity } from '@/lib/constants/packaging';
import { PackagingStockTable } from '@/components/delivery/packaging/PackagingStockTable';
import { resolvePackagingListState } from '@/components/delivery/packaging/packagingListState';
import { PackagingItemFormDialog } from '@/components/delivery/packaging/PackagingItemFormDialog';
import { PackagingAdjustDialog } from '@/components/delivery/packaging/PackagingAdjustDialog';
import { PackagingCategoryManagerDialog } from '@/components/delivery/packaging/PackagingCategoryManagerDialog';
import { PackagingConsumptionHistory } from '@/components/delivery/packaging/PackagingConsumptionHistory';

export function PackagingPageClient() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.managePackaging);
  const { data, isLoading, isError, error, isFetching, refetch, create, update, remove, adjust } =
    usePackaging();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingItemRow | null>(null);
  const [adjustItem, setAdjustItem] = useState<PackagingItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackagingItemRow | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  // ARGUS #286: search/category/status filters + pagination.
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  if (permissionsLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!canManage) {
    return (
      <Card className="border-mist">
        <CardContent className="text-espresso/60 p-8 text-center text-sm">
          You do not have permission to manage packaging stock.
        </CardContent>
      </Card>
    );
  }

  const items = data ?? [];
  const listState = resolvePackagingListState({
    isLoading,
    isError,
    itemCount: items.length,
  });
  const deleteBlocked = (deleteTarget?.quantityOnHand ?? 0) > 0;

  const categories = [
    ...new Map(items.map((item) => [item.category, item])).values(),
  ].map((item) => ({
    key: item.category,
    label: item.categoryName ?? item.category,
  }));
  const lowCount = items.filter(
    (item) => item.quantityOnHand <= item.lowStockThreshold,
  ).length;

  const term = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (stockFilter === 'low' && item.quantityOnHand > item.lowStockThreshold) return false;
    if (stockFilter === 'out' && item.quantityOnHand !== 0) return false;
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      (item.sku ?? '').toLowerCase().includes(term)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const openCreate = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEdit = (item: PackagingItemRow) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">Packaging Stock</h1>
          <p className="text-espresso/60 text-sm">
            Packaging materials consumed when parcels are dispatched.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>
            <Settings2 className="h-4 w-4" />
            Categories
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* ARGUS #286: surface the low-stock population on this page. */}
      {listState === 'ready' && lowCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
        >
          <p className="text-espresso text-sm">
            <strong>{lowCount}</strong> packaging item{lowCount === 1 ? '' : 's'} at or below
            their low-stock threshold.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
            onClick={() => {
              setStockFilter('low');
              setPage(1);
            }}
          >
            Show low stock
          </Button>
        </div>
      )}

      {listState === 'ready' && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="text-espresso/40 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or SKU…"
              aria-label="Search packaging items"
              className="pl-9"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.key} value={category.key}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stockFilter}
            onValueChange={(value) => {
              setStockFilter(value as 'all' | 'low' | 'out');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by stock status">
              <SelectValue placeholder="All stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {listState === 'loading' ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : listState === 'error' ? (
            <div
              role="alert"
              className="border-terracotta/30 bg-terracotta/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-terracotta mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-espresso text-sm font-medium">
                    Could not load packaging stock
                  </p>
                  <p className="text-espresso/70 mt-1 text-sm">
                    {error instanceof Error
                      ? error.message
                      : 'The packaging list could not be fetched.'}
                  </p>
                  <p className="text-espresso/50 mt-1 text-xs">
                    This is a load failure, not an empty inventory. Retry before adding or
                    adjusting stock.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="shrink-0"
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          ) : (
            <>
              <PackagingStockTable
                items={listState === 'empty' ? [] : pageItems}
                canManage={canManage}
                onAdjust={(item) => setAdjustItem(item)}
                onEdit={openEdit}
                onDelete={(item) => setDeleteTarget(item)}
                {...(items.length > 0 && filtered.length === 0
                  ? { emptyMessage: 'No packaging items match these filters.' }
                  : {})}
              />
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <p className="text-espresso/60">
                    Page {currentPage} of {totalPages} ({filtered.length}{' '}
                    {filtered.length === 1 ? 'item' : 'items'})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && <PackagingConsumptionHistory items={items} />}

      <PackagingItemFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        createPending={create.isPending}
        updatePending={update.isPending}
        onCreate={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              setFormOpen(false);
              setEditingItem(null);
            },
          })
        }
        onUpdate={(id, values) =>
          update.mutate(
            { id, ...values },
            {
              onSuccess: () => {
                setFormOpen(false);
                setEditingItem(null);
              },
            },
          )
        }
        onAdjustStock={(item) => {
          setFormOpen(false);
          setEditingItem(null);
          setAdjustItem(item);
        }}
      />

      <PackagingAdjustDialog
        item={adjustItem}
        onOpenChange={(open) => !open && setAdjustItem(null)}
        pending={adjust.isPending}
        onAdjust={(id, delta, note) =>
          adjust.mutate(
            { id, delta, ...(note ? { note } : {}) },
            { onSuccess: () => setAdjustItem(null) },
          )
        }
      />

      <PackagingCategoryManagerDialog
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Delete packaging item</DialogTitle>
            <DialogDescription>
              {deleteBlocked && deleteTarget ? (
                <>
                  <span className="text-espresso font-medium">{deleteTarget.name}</span> still has{' '}
                  {formatPackagingQuantity(deleteTarget.quantityOnHand, deleteTarget.unit)} on
                  hand. Deleting it would hide that stock without writing it off - adjust it to
                  zero first.
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <span className="text-espresso font-medium">{deleteTarget?.name}</span>? It will
                  no longer be tracked. Past consumption history is kept.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Use <strong>Adjust stock</strong> to write the remaining stock off; the change is
                recorded with a reason. Deletion unlocks once the item is empty.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            {deleteBlocked && deleteTarget ? (
              <Button
                onClick={() => {
                  const item = deleteTarget;
                  setDeleteTarget(null);
                  setAdjustItem(item);
                }}
              >
                Adjust stock
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (!deleteTarget) return;
                  remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                }}
              >
                {remove.isPending ? 'Deleting...' : 'Delete Item'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
