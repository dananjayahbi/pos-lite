'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUnitLabel } from '@/lib/services/rawMaterial.core';
import type { RawMaterialItem } from '@/hooks/useRawMaterials';

interface RawMaterialAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: RawMaterialItem | null;
}

export function RawMaterialAdjustDialog({
  open,
  onOpenChange,
  material,
}: RawMaterialAdjustDialogProps) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDelta('');
      setError(null);
    }
  }, [open, material]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/raw-materials/${material?.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: delta }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Request failed');
      return json;
    },
    onSuccess: () => {
      toast.success('Stock adjusted');
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-stats'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock — {material.name}</DialogTitle>
          <DialogDescription>
            Current quantity: {material.quantity} {getUnitLabel(material.unit)}. Enter a
            positive value to add stock or a negative value to consume stock.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rm-adjust">Quantity delta</Label>
            <Input
              id="rm-adjust"
              inputMode="decimal"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 5 or -3.5"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adjusting…' : 'Adjust'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
