'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteBom, useUpdateBom, type BomItemView } from '@/hooks/useBom';
import { BOM_LOCKED_MESSAGE, canModifyBom } from '@/lib/services/bom.core';

interface BomTableProps {
  items: BomItemView[];
  canEdit: boolean;
  canDelete: boolean;
  canProduce: boolean;
  onEdit: (id: string) => void;
  onProduce: (id: string) => void;
}

export function BomTable({
  items,
  canEdit,
  canDelete,
  canProduce,
  onEdit,
  onProduce,
}: BomTableProps) {
  const deleteMutation = useDeleteBom();
  const updateMutation = useUpdateBom();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // ARGUS #255: replace the browser-native confirm with a dialog that names
  // the production-history impact.
  const [deleteTarget, setDeleteTarget] = useState<BomItemView | null>(null);

  // ARGUS #251: retiring a recipe is separate from deleting it. Production
  // history keeps its recipe; only future production is blocked.
  const handleToggleActive = (bom: BomItemView) => {
    setTogglingId(bom.id);
    updateMutation.mutate(
      { id: bom.id, isActive: !bom.isActive },
      {
        onSuccess: () =>
          toast.success(bom.isActive ? 'BOM deactivated' : 'BOM activated'),
        onError: (err: Error) => toast.error(err.message),
        onSettled: () => setTogglingId(null),
      },
    );
  };

  const handleDelete = (bom: BomItemView) => {
    setDeleteTarget(bom);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('BOM deleted');
        setDeleteTarget(null);
      },
      onError: (err: Error) => toast.error(err.message),
      onSettled: () => setDeletingId(null),
    });
  };
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <FlaskConical className="mx-auto h-8 w-8 text-mist-ink" />
        <p className="mt-3 text-sm text-mist-ink">
          No bills of materials yet. Create one to start tracking production.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="rounded-lg border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Finished product</TableHead>
            <TableHead>Ingredients</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((bom) => {
            const locked = !canModifyBom(bom.productionLogCount);
            return (
              <TableRow key={bom.id}>
                <TableCell className="font-medium text-espresso">{bom.name}</TableCell>
                <TableCell>
                  <div className="text-sm text-espresso">{bom.variantName}</div>
                  <div className="text-xs text-mist-ink">{bom.variantSku}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-mist-ink">{bom.rawMaterialCount} materials</span>
                </TableCell>
                <TableCell>
                  <Badge variant={bom.isActive ? 'default' : 'secondary'}>
                    {bom.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canProduce && bom.isActive && (
                      <Button variant="outline" size="sm" onClick={() => onProduce(bom.id)}>
                        Produce
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglingId === bom.id}
                        onClick={() => handleToggleActive(bom)}
                      >
                        {togglingId === bom.id
                          ? 'Saving…'
                          : bom.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        title={locked ? BOM_LOCKED_MESSAGE : undefined}
                        onClick={() => onEdit(bom.id)}
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === bom.id || locked}
                        title={locked ? BOM_LOCKED_MESSAGE : undefined}
                        onClick={() => handleDelete(bom)}
                      >
                        {deletingId === bom.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    )}
                    {locked && (
                      <span className="basis-full text-xs text-mist-ink">
                        Locked - production recorded
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete BOM?</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                <span className="font-medium text-espresso">
                  {deleteTarget?.name ?? 'This recipe'}
                </span>{' '}
                will be removed from the BOM list and will no longer be available for
                production.
              </span>
              <span className="block">
                {deleteTarget && deleteTarget.productionLogCount > 0
                  ? `It has ${deleteTarget.productionLogCount} production run${
                      deleteTarget.productionLogCount === 1 ? '' : 's'
                    } recorded, so deletion is blocked - deactivate it instead to keep the history intact.`
                  : 'No production runs are recorded against this recipe, so no production history is affected.'}
              </span>
              {deleteTarget?.isActive ? (
                <span className="block">
                  It is currently active. Deactivating keeps the recipe for future use;
                  deleting removes it.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Keep BOM
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={
                deleteMutation.isPending ||
                (deleteTarget?.productionLogCount ?? 0) > 0
              }
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
