'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type PackagingItemRow } from '@/hooks/delivery/usePackaging';
import { formatPackagingQuantity, getPackagingUnitShortLabel } from '@/lib/constants/packaging';

interface PackagingAdjustDialogProps {
  item: PackagingItemRow | null;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onAdjust: (id: string, delta: number, note?: string) => void;
}

/**
 * Stock adjustment dialog. Shows the current on-hand quantity and lets the
 * operator type the new level (rather than a raw delta), which is what the
 * shop actually knows after a physical count. The delta is derived on submit.
 */
export function PackagingAdjustDialog(props: PackagingAdjustDialogProps) {
  // Mounting the form only while an item is selected (keyed by id) keeps the
  // prefilled "new level" value in sync without a state-in-effect reset.
  if (!props.item) return null;
  return <PackagingAdjustForm key={props.item.id} {...props} item={props.item} />;
}

function PackagingAdjustForm({
  item,
  onOpenChange,
  pending,
  onAdjust,
}: PackagingAdjustDialogProps & { item: PackagingItemRow }) {
  const [level, setLevel] = useState<string>(String(item.quantityOnHand));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = item.quantityOnHand;
  const parsed = level.trim() === '' ? Number.NaN : Number(level);
  const delta = Number.isFinite(parsed) ? Math.trunc(parsed) - current : 0;
  const invalid = !Number.isFinite(parsed) || parsed < 0 || delta === 0;
  const suffix = getPackagingUnitShortLabel(item.unit);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a stock level of 0 or more');
      return;
    }
    if (delta === 0) {
      setError('The new stock level matches the current stock');
      return;
    }
    setError(null);
    onAdjust(item.id, delta, note.trim() || undefined);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Adjust Stock</DialogTitle>
          <DialogDescription>Update on-hand quantity for {item.name}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-espresso/10 bg-espresso/[0.03] flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-espresso/60 text-sm">Current stock</span>
            <span className="text-espresso text-sm font-semibold">
              {formatPackagingQuantity(current, item.unit)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-level">New stock level{suffix ? ` (${suffix})` : ''}</Label>
            <Input
              id="adj-level"
              type="number"
              step="1"
              min={0}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              autoFocus
            />
            {Number.isFinite(parsed) && delta !== 0 ? (
              <p className="text-espresso/50 text-xs">
                {delta > 0 ? `Adds ${delta}` : `Removes ${Math.abs(delta)}`} to inventory
              </p>
            ) : null}
            {error ? <p className="text-terracotta text-sm">{error}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Note</Label>
            <Input
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reason (audited)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || invalid}>
              {pending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
