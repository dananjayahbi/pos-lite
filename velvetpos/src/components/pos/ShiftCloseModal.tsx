'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ShiftCloseModalProps {
  shiftId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShiftSummary {
  expectedCash: number;
}

export function ShiftCloseModal({
  shiftId,
  open,
  onOpenChange,
}: ShiftCloseModalProps) {
  const router = useRouter();
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [heldSalesCount, setHeldSalesCount] = useState(0);

  useEffect(() => {
    if (!open) return;

    setClosingCash('');
    setNotes('');
    setError('');
    setSummary(null);
    setHeldSalesCount(0);

    async function fetchSummary() {
      setSummaryLoading(true);
      try {
        const res = await fetch(`/api/store/shifts/${shiftId}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data;
          const expectedCash =
            (data.openingFloat ?? 0) + (data.cashSalesTotal ?? 0);
          setSummary({ expectedCash });
        }
      } catch {
        // Non-critical — summary is a convenience preview
      } finally {
        setSummaryLoading(false);
      }

      try {
        const res2 = await fetch(
          `/api/store/sales?shiftId=${shiftId}&status=OPEN&limit=1`,
        );
        if (res2.ok) {
          const json2 = await res2.json();
          setHeldSalesCount((json2.meta?.total as number) ?? 0);
        }
      } catch {
        // Non-critical
      }
    }

    fetchSummary();
  }, [open, shiftId]);

  const closingValue = parseFloat(closingCash);
  const discrepancy =
    summary && !isNaN(closingValue)
      ? closingValue - summary.expectedCash
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const value = parseFloat(closingCash);
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { closingCashCount: value };
      if (notes.trim()) {
        body.notes = notes.trim();
      }

      const res = await fetch(`/api/store/shifts/${shiftId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error?.message ?? `Failed to close shift (${res.status})`,
        );
        return;
      }

      toast.success('Shift closed successfully');
      onOpenChange(false);
      router.push(`/pos/shift-report?shiftId=${shiftId}`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Close Shift &amp; Reconcile
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-espresso/60">
            Count the cash in your till and enter the total below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {heldSalesCount > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm font-body text-amber-800">
              You have {heldSalesCount} held sale{heldSalesCount !== 1 ? 's' : ''}{' '}
              that will be cancelled when you close this shift. To avoid losing
              them, retrieve and complete or discard them before closing.
            </div>
          )}

          <div>
            <Label htmlFor="closing-cash" className="font-body">
              Closing Cash Count
            </Label>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm font-body text-espresso/60">Rs.</span>
              <Input
                id="closing-cash"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0.00"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {/* Live preview */}
          {summaryLoading && (
            <p className="text-xs text-mist font-body">
              Loading shift summary…
            </p>
          )}
          {summary && (
            <div className="rounded-lg bg-linen p-3 space-y-1 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-espresso/70">Expected cash</span>
                <span className="text-espresso font-mono">
                  Rs. {summary.expectedCash.toFixed(2)}
                </span>
              </div>
              {discrepancy !== null && (
                <div className="flex justify-between">
                  <span className="text-espresso/70">Discrepancy</span>
                  <span
                    className={`font-mono ${
                      discrepancy === 0
                        ? 'text-espresso'
                        : discrepancy > 0
                          ? 'text-green-600'
                          : 'text-red-500'
                    }`}
                  >
                    {discrepancy >= 0 ? '+' : ''}
                    Rs. {discrepancy.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="shift-notes" className="font-body">
              Notes{' '}
              <span className="text-mist text-xs font-normal">(optional)</span>
            </Label>
            <textarea
              id="shift-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              className="mt-1.5 w-full rounded-lg border border-mist px-3 py-2 text-sm font-body bg-white text-espresso placeholder:text-mist focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand transition-colors resize-none"
              placeholder="Any notes about this shift…"
              disabled={loading}
            />
            <p className="text-xs text-mist font-body mt-1 text-right">
              {notes.length}/500
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-espresso text-pearl hover:bg-espresso/90"
          >
            {loading ? 'Closing…' : 'Close Shift & Reconcile'}
          </Button>

          {error && (
            <p className="text-sm text-red-500 font-body">{error}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
