'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  const payoutMutation = useMutation({
    mutationFn: async (target: CommissionSummary) => {
      const res = await fetch('/api/store/staff/commissions/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: target.userId,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd + 'T23:59:59.999Z').toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ['commission-summary'] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const summaries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-espresso">Commission Reports</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info('This feature is coming soon')}
        >
          Export CSV
        </Button>
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
    </div>
  );
}
