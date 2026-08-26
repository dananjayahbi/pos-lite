'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  useBom,
  useProductionPlan,
  useProduceGoods,
} from '@/hooks/useBom';
import { getUnitShortLabel } from '@/lib/services/rawMaterial.core';

interface ProductionLogDialogProps {
  bomId: string | null;
  onClose: () => void;
}

export function ProductionLogDialog({ bomId, onClose }: ProductionLogDialogProps) {
  const { data: bomData } = useBom(bomId);
  const produceMutation = useProduceGoods();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;

  const { data: planData } = useProductionPlan(bomId, validQty ? qty : 0);

  useEffect(() => {
    if (bomId) {
      setQuantity('1');
      setNote('');
      setError(null);
    }
  }, [bomId]);

  const bom = bomData?.data;
  const plan = planData?.data;
  const canSubmit = validQty && plan?.sufficient === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomId) return;
    setError(null);
    produceMutation
      .mutateAsync({
        bomId,
        quantity: qty,
        ...(note ? { note } : {}),
      })
      .then(() => {
        toast.success(`Production of ${qty} unit(s) logged`);
        onClose();
      })
      .catch((err: Error) => setError(err.message));
  };

  return (
    <Dialog open={bomId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log production</DialogTitle>
          <DialogDescription>
            {bom ? `${bom.variantName} (${bom.variantSku})` : 'Loading BOM…'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prod-qty">Quantity produced</Label>
            <Input
              id="prod-qty"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
            />
          </div>

          {plan ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-mist">
                Raw material consumption
              </p>
              <ul className="space-y-1">
                {plan.consumption.map((line) => (
                  <li
                    key={line.rawMaterialId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-espresso">{line.rawMaterialName}</span>
                    <span
                      className={
                        line.insufficient ? 'font-semibold text-red-600' : 'text-mist'
                      }
                    >
                      {line.required} {getUnitShortLabel(line.unit as 'LITERS' | 'KILOGRAMS')}
                      {line.insufficient
                        ? ` (only ${line.available})`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                {plan.sufficient ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Sufficient stock
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" /> Insufficient stock for this run
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-mist">
              {validQty ? 'Calculating consumption…' : 'Enter a quantity to preview consumption.'}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="prod-note">Note (optional)</Label>
            <Textarea
              id="prod-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Production batch note"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={produceMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || produceMutation.isPending}>
              {produceMutation.isPending ? 'Logging…' : 'Log production'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
