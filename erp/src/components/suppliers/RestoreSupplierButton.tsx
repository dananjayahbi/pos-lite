'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RestoreSupplierButtonProps {
  supplierId: string;
  supplierName: string;
}

/**
 * M06-05 (OBS-10) — recovery affordance for archived suppliers.
 *
 * Shown on rows of the suppliers list when the "Include archived" toggle is
 * on and the row is archived. Confirms, calls
 * POST /api/store/suppliers/[id]/unarchive (audited as SUPPLIER_UNARCHIVED),
 * then refreshes the list and toasts. Mirrors RestoreProductButton's shape so
 * the two recovery actions can't drift apart.
 */
export function RestoreSupplierButton({ supplierId, supplierName }: RestoreSupplierButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/suppliers/${supplierId}/unarchive`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to restore supplier');
      }
      return body;
    },
    onSuccess: () => {
      toast.success(`${supplierName} restored`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore supplier');
      // A 404/409 usually means the list is stale — refetch so the row stops
      // offering the action.
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Unarchive ${supplierName}`}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => !isOpen && !unarchiveMutation.isPending && setOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore {supplierName}?</DialogTitle>
            <DialogDescription>
              The supplier will reappear in the active list and become editable again. Nothing
              else changes — PO history is untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={unarchiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
            >
              {unarchiveMutation.isPending ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
