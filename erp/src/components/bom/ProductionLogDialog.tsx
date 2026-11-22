'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
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
import { factoryFeedErrorMessage } from '@/components/raw-materials/factoryDashboardState';

interface ProductionLogDialogProps {
  bomId: string | null;
  onClose: () => void;
}

export function ProductionLogDialog({ bomId, onClose }: ProductionLogDialogProps) {
  const {
    data: bomData,
    isError: bomError,
    error: bomErrorObj,
    isFetching: bomFetching,
    refetch: refetchBom,
  } = useBom(bomId);
  const produceMutation = useProduceGoods();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;

  const {
    data: planData,
    isError: planError,
    error: planErrorObj,
    isFetching: planFetching,
    refetch: refetchPlan,
  } = useProductionPlan(bomId, validQty ? qty : 0);

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
      .then((json: { data?: { batchNumber?: string } } | null) => {
        const batch = json?.data?.batchNumber;
        toast.success(
          batch
            ? `Production of ${qty} unit(s) logged - batch ${batch}`
            : `Production of ${qty} unit(s) logged`,
        );
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
            {bom
              ? `${bom.variantName} (${bom.variantSku})`
              : plan
                ? `${plan.variantName} (${plan.variantSku})`
                : bomError
                  ? 'BOM details could not be loaded.'
                  : 'Loading BOM…'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {bomError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <div>
                <p className="font-body text-sm font-medium text-red-800">
                  BOM details could not be loaded
                </p>
                <p className="font-body text-xs text-red-600">
                  {factoryFeedErrorMessage(bomErrorObj, 'The BOM request failed.')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-200 bg-white text-red-700 hover:bg-red-100"
                onClick={() => refetchBom()}
                disabled={bomFetching}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${bomFetching ? 'animate-spin' : ''}`} />
                {bomFetching ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          ) : null}

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

          {planError ? (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <p className="flex items-center gap-1 font-body text-sm font-medium text-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Consumption could not be calculated
              </p>
              <p className="font-body text-xs text-red-600">
                {factoryFeedErrorMessage(planErrorObj, 'The production plan request failed.')}
              </p>
              <p className="font-body text-xs text-red-600">
                Production cannot be logged until the plan loads.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-200 bg-white text-red-700 hover:bg-red-100"
                onClick={() => refetchPlan()}
                disabled={planFetching}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${planFetching ? 'animate-spin' : ''}`} />
                {planFetching ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          ) : plan ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-mist-ink">
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
                        line.insufficient ? 'font-semibold text-red-600' : 'text-mist-ink'
                      }
                    >
                      {line.required} {line.unitShortLabel}
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
            <p className="text-sm text-mist-ink">
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
