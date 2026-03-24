'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';

interface CommissionSummary {
  userId: string;
  email: string;
  role: string;
  totalEarned: string;
  totalPaid: string;
  unpaid: string;
}

interface CommissionPayoutHistoryRecord {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  totalEarned: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  authorizedByEmail: string;
  note: string | null;
  paymentMethod: string | null;
  proofReference: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-espresso text-pearl',
  MANAGER: 'bg-terracotta text-pearl',
  CASHIER: 'bg-sand text-espresso',
  STOCK_CLERK: 'bg-mist text-espresso',
};

function getDefaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function CommissionReportsPage() {
  const queryClient = useQueryClient();
  const defaults = getDefaultPeriod();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [payoutTarget, setPayoutTarget] = useState<CommissionSummary | undefined>(undefined);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [proofReference, setProofReference] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<CommissionPayoutHistoryRecord | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: CommissionSummary[] }>({
    queryKey: ['commission-summary', periodStart, periodEnd],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd + 'T23:59:59.999Z').toISOString(),
      });
      const res = await fetch(`/api/store/staff/commissions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch commission summary');
      return res.json();
    },
  });

  const { data: payoutHistoryData, isLoading: payoutHistoryLoading } = useQuery<{
    success: boolean;
    data: { records: CommissionPayoutHistoryRecord[] };
  }>({
    queryKey: ['commission-payout-history', periodStart, periodEnd],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd + 'T23:59:59.999Z').toISOString(),
      });
      const res = await fetch(`/api/store/staff/commissions/payouts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch payout history');
      return res.json();
    },
  });

  const payoutMutation = useMutation({
    mutationFn: async (target: CommissionSummary) => {
      const res = await fetch('/api/store/staff/commissions/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: target.userId,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd + 'T23:59:59.999Z').toISOString(),
          notes: payoutNotes.trim() || undefined,
          paymentMethod,
          proofReference: proofReference.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Failed to create payout');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Payout recorded successfully');
      setPayoutOpen(false);
      setPayoutTarget(undefined);
      setPayoutNotes('');
      setProofReference('');
      setPaymentMethod('Bank Transfer');
      queryClient.invalidateQueries({ queryKey: ['commission-summary'] });
      queryClient.invalidateQueries({ queryKey: ['commission-payout-history'] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const summaries = data?.data ?? [];
  const payoutHistory = payoutHistoryData?.data.records ?? [];
  const totalUnpaid = useMemo(
    () => summaries.reduce((sum, summary) => sum + Number(summary.unpaid), 0),
    [summaries],
  );

  const downloadCSV = useCallback(() => {
    if (summaries.length === 0) {
      toast.info('No commission data to export for this period.');
      return;
    }
    const rows: string[][] = [
      ['Staff Email', 'Role', 'Total Earned (LKR)', 'Total Paid (LKR)', 'Unpaid Balance (LKR)', 'Period Start', 'Period End'],
      ...summaries.map((s) => [
        s.email,
        s.role,
        Number(s.totalEarned).toFixed(2),
        Number(s.totalPaid).toFixed(2),
        Number(s.unpaid).toFixed(2),
        periodStart,
        periodEnd,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commissions_${periodStart}_to_${periodEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Commission report downloaded.');
  }, [summaries, periodStart, periodEnd]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-espresso">Commission Reports</h1>
          <p className="mt-1 text-sm text-sand">Track unpaid balances, record proof of payout, and revisit payout receipts without leaving the commissions workflow.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-mist bg-pearl/40 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-sand">Open liability</p>
            <p className="font-display text-2xl text-espresso">{formatRupee(totalUnpaid.toFixed(2))}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCSV}
            disabled={isLoading || summaries.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="period-start" className="text-xs text-sand">
                Period Start
              </Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period-end" className="text-xs text-sand">
                Period End
              </Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-44"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sand text-sm">
            No commission data for this period.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display text-espresso">Staff Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Total Earned</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Unpaid</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.userId}>
                    <TableCell className="text-espresso">{s.email}</TableCell>
                    <TableCell>
                      <Badge className={`${ROLE_COLORS[s.role] ?? 'bg-mist text-espresso'} hover:opacity-90`}>
                        {s.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatRupee(s.totalEarned)}</TableCell>
                    <TableCell className="text-right font-mono">{formatRupee(s.totalPaid)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(s.unpaid) > 0 ? (
                        <span className="text-terracotta font-semibold">{formatRupee(s.unpaid)}</span>
                      ) : (
                        formatRupee(s.unpaid)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(s.unpaid) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPayoutTarget(s);
                            setPayoutOpen(true);
                          }}
                        >
                          Mark as Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display text-espresso">Recent Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutHistoryLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payoutHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-mist bg-pearl/50 px-4 py-8 text-center text-sm text-sand">
              No payouts recorded for the selected window yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutHistory.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-espresso">{payout.userEmail}</p>
                        <p className="text-xs text-sand">Approved by {payout.authorizedByEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-sand">{new Date(payout.paidAt).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-espresso">{payout.paymentMethod ?? 'Manual'}</TableCell>
                    <TableCell className="text-right font-mono">{formatRupee(payout.totalEarned)}</TableCell>
                    <TableCell className="text-sm text-sand">{payout.proofReference ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedHistory(payout)}>
                        View Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payout Confirmation Dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirm Commission Payout</DialogTitle>
          </DialogHeader>
          {payoutTarget && (
            <div className="space-y-4">
              <p className="text-sm text-espresso">
                Record payout of{' '}
                <span className="font-semibold">{formatRupee(payoutTarget.unpaid)}</span>{' '}
                to <span className="font-semibold">{payoutTarget.email}</span> for the period{' '}
                {periodStart} to {periodEnd}?
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Input id="payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Bank Transfer" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proof-reference">Proof / Receipt Ref</Label>
                  <Input id="proof-reference" value={proofReference} onChange={(e) => setProofReference(e.target.value)} placeholder="TRX-2026-0001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-notes">Internal Notes</Label>
                <Input id="payout-notes" value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="Transferred via BOC online banking" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayoutOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => payoutMutation.mutate(payoutTarget)}
                  disabled={payoutMutation.isPending}
                >
                  {payoutMutation.isPending ? 'Processing...' : 'Confirm Payout'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={selectedHistory !== null} onOpenChange={(open) => !open && setSelectedHistory(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Commission Payout Receipt</DialogTitle>
          </DialogHeader>
          {selectedHistory && (
            <div className="max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-mist bg-pearl/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sand">Staff Member</p>
                  <p className="mt-1 font-medium text-espresso">{selectedHistory.userEmail}</p>
                  <p className="text-xs text-sand">Role: {selectedHistory.userRole.replace('_', ' ')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-mist p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-sand">Amount</p>
                    <p className="mt-2 font-display text-3xl text-espresso">{formatRupee(selectedHistory.totalEarned)}</p>
                  </div>
                  <div className="rounded-lg border border-mist p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-sand">Paid At</p>
                    <p className="mt-2 text-espresso">{new Date(selectedHistory.paidAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-mist p-4 text-sand">
                  <p><span className="font-medium text-espresso">Commission window:</span> {new Date(selectedHistory.periodStart).toLocaleDateString()} → {new Date(selectedHistory.periodEnd).toLocaleDateString()}</p>
                  <p><span className="font-medium text-espresso">Payment method:</span> {selectedHistory.paymentMethod ?? 'Manual / not specified'}</p>
                  <p><span className="font-medium text-espresso">Proof reference:</span> {selectedHistory.proofReference ?? 'Not recorded'}</p>
                  <p><span className="font-medium text-espresso">Authorised by:</span> {selectedHistory.authorizedByEmail}</p>
                </div>
                <div className="rounded-lg border border-dashed border-mist bg-pearl/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sand">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-espresso">{selectedHistory.note ?? 'No notes recorded for this payout.'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
