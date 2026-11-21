'use client';

import { useState } from 'react';

import { usePackaging, type PackagingItemRow } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Settings2, AlertTriangle } from 'lucide-react';
import { formatPackagingQuantity } from '@/lib/constants/packaging';
import { PackagingStockTable } from '@/components/delivery/packaging/PackagingStockTable';
import { PackagingItemFormDialog } from '@/components/delivery/packaging/PackagingItemFormDialog';
import { PackagingAdjustDialog } from '@/components/delivery/packaging/PackagingAdjustDialog';
import { PackagingCategoryManagerDialog } from '@/components/delivery/packaging/PackagingCategoryManagerDialog';

export function PackagingPageClient() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.managePackaging);
  const { data, isLoading, create, update, remove, adjust } = usePackaging();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingItemRow | null>(null);
  const [adjustItem, setAdjustItem] = useState<PackagingItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackagingItemRow | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

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
  const deleteBlocked = (deleteTarget?.quantityOnHand ?? 0) > 0;

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

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <PackagingStockTable
              items={items}
              canManage={canManage}
              onAdjust={(item) => setAdjustItem(item)}
              onEdit={openEdit}
              onDelete={(item) => setDeleteTarget(item)}
            />
          )}
        </CardContent>
      </Card>

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

      {items.length === 0 && !isLoading ? (
        <div className="border-espresso/20 text-espresso/50 flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm">
          No packaging items - add your first item above.
        </div>
      ) : null}
    </div>
  );
}
