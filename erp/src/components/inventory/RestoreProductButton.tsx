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

interface RestoreProductButtonProps {
  productId: string;
  productName: string;
}

/**
 * M02-03 (BUG-20) — recovery affordance for soft-deleted products.
 *
 * Shown on rows of the Inventory "Deleted" filter view. Confirms, calls
 * POST /api/store/products/[id]/restore, then refreshes the list and toasts.
 * A 409 (e.g. "Restore blocked: SKU … now belongs to another product") is
 * surfaced with the server's message rather than a generic failure.
 */
export function RestoreProductButton({ productId, productName }: RestoreProductButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/products/${productId}/restore`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to restore product');
      }
      return body;
    },
    onSuccess: () => {
      toast.success(`${productName} has been restored.`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore product');
      // A 409 usually means the list is stale (already restored elsewhere) —
      // refetch so the Deleted view stops offering the action.
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-espresso/60 transition-colors hover:text-espresso"
        onClick={() => setOpen(true)}
        aria-label={`Restore ${productName}`}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !restoreMutation.isPending && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Restore Product</DialogTitle>
            <DialogDescription className="font-body text-mist">
              Restore &ldquo;{productName}&rdquo; and its variants to the active catalog? Stock
              levels and prices are kept as they were when the product was deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => setOpen(false)}
              disabled={restoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
