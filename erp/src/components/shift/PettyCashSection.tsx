'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Decimal from 'decimal.js';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupee } from '@/lib/format';
import RecordCashMovementForm from '@/components/shift/RecordCashMovementForm';

interface CashMovementRow {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  authorizedByName: string | null;
  createdAt: string;
}

interface PettyCashSectionProps {
  shiftId: string;
  isOpen: boolean;
}

async function fetchCashMovements(shiftId: string): Promise<CashMovementRow[]> {
  const res = await fetch(`/api/store/shifts/${shiftId}/cash-movements`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to load cash movements (${res.status})`);
  }
  const json = await res.json();
  return json.data as CashMovementRow[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function typeLabel(type: string) {
  switch (type) {
    case 'PETTY_CASH_OUT':
      return 'Out';
    case 'MANUAL_IN':
      return 'In';
    case 'MANUAL_OUT':
      return 'Out';
    case 'OPENING_FLOAT':
      return 'Float';
    default:
      return type;
  }
}

function isOutflow(type: string) {
  return type === 'PETTY_CASH_OUT' || type === 'MANUAL_OUT';
}

export default function PettyCashSection({ shiftId, isOpen }: PettyCashSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: movements, isLoading, error } = useQuery({
    queryKey: ['cash-movements', shiftId],
    queryFn: () => fetchCashMovements(shiftId),
    enabled: !!shiftId,
  });

  const handleSubmit = async (data: { type: string; amount: number; reason: string }) => {
    const res = await fetch(`/api/store/shifts/${shiftId}/cash-movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message ?? 'Failed to record cash movement');
    }

    await queryClient.invalidateQueries({ queryKey: ['cash-movements', shiftId] });
    await queryClient.invalidateQueries({ queryKey: ['z-report', shiftId] });
    setDialogOpen(false);
    toast.success('Cash movement recorded');
  };

  // Filter out OPENING_FLOAT for display — those are implicit
  const displayMovements = (movements ?? []).filter((m) => m.type !== 'OPENING_FLOAT');

  const netPettyCash = displayMovements.reduce((acc, m) => {
    const val = new Decimal(m.amount);
    return isOutflow(m.type) ? acc.minus(val) : acc.plus(val);
  }, new Decimal(0));

  const totalCashDeposited = displayMovements
    .filter((m) => m.type === 'MANUAL_IN')
    .reduce((acc, m) => acc.plus(new Decimal(m.amount)), new Decimal(0));

  const totalPettyCashOut = displayMovements
    .filter((m) => isOutflow(m.type))
    .reduce((acc, m) => acc.plus(new Decimal(m.amount)), new Decimal(0));

  return (
    <section className="rounded-lg border border-mist bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-espresso">Petty Cash Movements</h2>
        {isOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-terracotta text-terracotta hover:bg-sand print:hidden"
              >
                <Plus className="h-4 w-4" />
                Record Petty Cash
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-espresso">Record Cash Movement</DialogTitle>
              </DialogHeader>
              <RecordCashMovementForm onSubmit={handleSubmit} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 font-body">
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && displayMovements.length === 0 && (
        <p className="text-sm text-espresso/50 font-body py-2">No cash movements recorded.</p>
      )}

      {!isLoading && !error && displayMovements.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-mist text-left text-espresso/60">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Recorded By</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayMovements.map((m) => (
                  <tr key={m.id} className="border-b border-mist/50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-espresso">{formatTime(m.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={
                          isOutflow(m.type)
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-green-300 bg-green-50 text-green-700'
                        }
                      >
                        {typeLabel(m.type)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-espresso/70">{m.reason ?? '—'}</td>
                    <td className="py-2 pr-3 text-espresso/70">{m.authorizedByName ?? '—'}</td>
                    <td className="py-2 text-right font-mono text-espresso">
                      {isOutflow(m.type) ? '−' : '+'}{formatRupee(m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-mist pt-2 flex justify-between items-center">
            <span className="font-body text-sm text-espresso/70">Net Petty Cash</span>
            <span
              className={`font-mono text-sm font-semibold ${
                netPettyCash.isNegative() ? 'text-red-500' : 'text-espresso'
              }`}
            >
              {netPettyCash.isNegative() ? '−' : '+'}{formatRupee(netPettyCash.abs().toDecimalPlaces(2).toNumber())}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
